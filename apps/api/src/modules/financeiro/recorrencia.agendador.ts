import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DIAS_DE_ANTECEDENCIA_RECORRENCIA, ocorrenciaDoCiclo } from '@gestao/shared-types';
import { uuidv7 } from '../../common/uuid';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { hojeEmDia, paraData, paraDia } from './datas';

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Moldes processados por passagem. O que sobrar entra na do dia seguinte.
 *
 * Existe para que um pico — muitas empresas com vencimento no mesmo dia — não
 * vire uma passagem de dez minutos segurando conexões do pool.
 */
const LIMITE_POR_PASSAGEM = 200;

/**
 * Transforma moldes de recorrência em lançamentos de verdade.
 *
 * ## Quando gera
 *
 * Trinta dias antes do vencimento (`DIAS_DE_ANTECEDENCIA_RECORRENCIA`), e não
 * no dia. Uma conta que aparece no dia em que vence chega tarde para quem
 * precisa se organizar; com a antecedência, a próxima ocorrência está sempre
 * visível em "contas a pagar" com tempo de reagir.
 *
 * ## Por que gera uma por passagem
 *
 * Cada passagem cria **uma** ocorrência por molde e avança o cursor. Uma
 * recorrência mensal cadastrada com início antigo não despeja doze lançamentos
 * de uma vez: ela se acerta ao longo de doze madrugadas.
 *
 * Isso é deliberado. Gerar tudo de uma vez encheria as contas a pagar de
 * lançamentos retroativos que ninguém pediu, e um cadastro com data errada —
 * início em 2020 em vez de 2026 — viraria setenta e duas linhas antes de alguém
 * perceber.
 *
 * ## Como evita duplicar
 *
 * O avanço do cursor é uma troca condicional: o `updateMany` exige que
 * `ocorrencias` ainda seja o valor lido. Se outra passagem tiver avançado no
 * meio do caminho, o `count` volta zero e esta desiste sem criar nada.
 *
 * É o que mantém a geração correta mesmo se o agendador rodar duas vezes — o
 * que acontece de verdade quando o plano gratuito reinicia a instância.
 */
@Injectable()
export class RecorrenciaAgendador {
  private readonly logger = new Logger(RecorrenciaAgendador.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM, { timeZone: 'America/Sao_Paulo' })
  async executar(): Promise<void> {
    try {
      const gerados = await this.gerarPendentes();

      if (gerados > 0) {
        this.logger.log(`${gerados} lançamento(s) gerado(s) a partir de recorrências.`);
      }
    } catch (erro) {
      // Roda de novo amanhã. Derrubar o processo não geraria nada mais cedo, e
      // o cursor não avançou — nada foi perdido.
      this.logger.error(
        `Falha na geração de recorrências: ${erro instanceof Error ? erro.message : String(erro)}`,
      );
    }
  }

  async gerarPendentes(hoje: string = hojeEmDia()): Promise<number> {
    const corte = new Date(
      new Date(`${hoje}T00:00:00Z`).getTime() + DIAS_DE_ANTECEDENCIA_RECORRENCIA * DIA_MS,
    );

    // Permitido pela política `recorrencia_varredura`: só com a varredura
    // declarada, e só moldes ativos e próximos do vencimento (migration
    // `20261001120000_politicas_declaradas`).
    const moldes = await this.prisma.comVarredura(
      'recorrencias',
      'geração de recorrências: roda fora de requisição e precisa achar os moldes vencendo em todas as empresas',
      (db) =>
        db.lancamentoRecorrente.findMany({
          where: { ativo: true, proximaEm: { lte: corte } },
          select: { id: true, tenantId: true, ocorrencias: true },
          orderBy: { proximaEm: 'asc' },
          take: LIMITE_POR_PASSAGEM,
        }),
    );

    let gerados = 0;

    for (const molde of moldes) {
      try {
        if (await this.gerarUma(molde.tenantId, molde.id, molde.ocorrencias)) {
          gerados++;
        }
      } catch (erro) {
        // A falha de uma empresa não impede as outras — é o mesmo princípio da
        // exclusão de contas canceladas.
        this.logger.error(
          `Não foi possível gerar a recorrência ${molde.id}: ${erro instanceof Error ? erro.message : String(erro)}`,
        );
      }
    }

    return gerados;
  }

  /**
   * Gera uma ocorrência, dentro do contexto da empresa dona do molde.
   *
   * Devolve `false` quando não havia nada a fazer: o molde foi desligado,
   * chegou ao fim, ou outra passagem avançou o cursor primeiro.
   */
  private async gerarUma(
    tenantId: string,
    recorrenciaId: string,
    ocorrenciasLidas: number,
  ): Promise<boolean> {
    return this.prisma.comTenantExplicito(tenantId, async (tx) => {
      // Relê dentro do contexto: a varredura viu apenas três colunas, e o resto
      // do molde só é legível com o tenant definido.
      const molde = await tx.lancamentoRecorrente.findUnique({ where: { id: recorrenciaId } });

      if (!molde || !molde.ativo) return false;

      const inicio = paraDia(molde.inicio)!;
      const vencimento = ocorrenciaDoCiclo(inicio, molde.periodicidade, molde.ocorrencias);

      // Passou do fim combinado: desliga em vez de continuar aparecendo na
      // varredura todos os dias sem nada a fazer.
      if (molde.fim && vencimento > paraDia(molde.fim)!) {
        await tx.lancamentoRecorrente.update({
          where: { id: recorrenciaId },
          data: { ativo: false },
        });
        return false;
      }

      // Troca condicional: se outra passagem avançou o cursor desde a leitura,
      // `count` é zero e esta desiste sem criar lançamento nenhum.
      const { count } = await tx.lancamentoRecorrente.updateMany({
        where: { id: recorrenciaId, ocorrencias: ocorrenciasLidas },
        data: {
          ocorrencias: { increment: 1 },
          proximaEm: paraData(
            ocorrenciaDoCiclo(inicio, molde.periodicidade, molde.ocorrencias + 1),
          )!,
        },
      });

      if (count === 0) return false;

      await tx.lancamentoFinanceiro.create({
        data: {
          id: uuidv7(),
          tenantId,
          tipo: molde.tipo,
          natureza: molde.natureza,
          descricao: molde.descricao,
          valor: molde.valor,
          // Competência no vencimento: a conta pertence ao mês em que é devida.
          // Usar a data da geração jogaria o aluguel de novembro em outubro,
          // porque a geração acontece com trinta dias de antecedência.
          data: paraData(vencimento)!,
          vencimento: paraData(vencimento),
          // Nasce em aberto, sempre. Quem dá baixa é quem paga.
          pagoEm: null,
          categoriaId: molde.categoriaId,
          servicoId: molde.servicoId,
          clienteId: molde.clienteId,
          recorrenciaId,
        },
      });

      return true;
    });
  }
}
