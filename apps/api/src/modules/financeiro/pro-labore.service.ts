import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CODIGOS_ERRO,
  type ProLabore,
  type ProLaboreFormInput,
  type SugestaoProLabore,
} from '@gestao/shared-types';
import { uuidv7 } from '../../common/uuid';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { tenantAtual } from '../../infra/tenant/tenant-context';
import { ZERO } from './decimal';
import {
  hojeEmDia,
  paraData,
  paraDia,
  primeiroDiaDeMesesAtras,
  ultimoDiaDoMesPassado,
} from './datas';
import { FinanceiroService } from './financeiro.service';

/** Em quantos meses a reserva deve alcançar a meta, quando há uma. */
const MESES_PARA_COMPLETAR_RESERVA = 12;

/**
 * Pró-labore: quanto o dono retira, e quanto ele **poderia** retirar.
 *
 * O histórico com vigência é o que mantém o passado estável: reajustar a
 * retirada em agosto não pode mudar o relatório de março. Cada valor vale de
 * uma data até outra, e a vigência em aberto é o valor de hoje.
 */
@Injectable()
export class ProLaboreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeiro: FinanceiroService,
  ) {}

  /** Histórico completo, do mais recente para o mais antigo. */
  async listar(): Promise<ProLabore[]> {
    const registros = await this.prisma.comTenant((tx) =>
      tx.proLabore.findMany({ orderBy: { vigenciaInicio: 'desc' } }),
    );

    return registros.map((registro) => this.paraResposta(registro));
  }

  /**
   * Define um novo valor a partir de uma data.
   *
   * Fecha a vigência aberta anterior no dia anterior ao início da nova, em vez
   * de sobrescrever: é isso que preserva o histórico. Tudo na mesma transação —
   * se o fechamento falhasse depois da criação, existiriam duas vigências
   * abertas ao mesmo tempo e "o valor atual" viraria ambíguo.
   */
  async definir(dados: ProLaboreFormInput): Promise<ProLabore> {
    const inicio = paraData(dados.vigenciaInicio)!;

    const criado = await this.prisma.comTenant(async (tx) => {
      const jaExiste = await tx.proLabore.findFirst({
        where: { vigenciaInicio: inicio },
        select: { id: true },
      });

      if (jaExiste) {
        throw new BadRequestException({
          codigo: CODIGOS_ERRO.CONFLITO,
          mensagem: 'Já existe um pró-labore com esta data de início. Edite ou remova o outro.',
        });
      }

      // Um dia antes do novo início. Fechar no mesmo dia deixaria as duas
      // vigências válidas na data da virada.
      const fim = new Date(inicio);
      fim.setUTCDate(fim.getUTCDate() - 1);

      await tx.proLabore.updateMany({
        where: { vigenciaFim: null, vigenciaInicio: { lt: inicio } },
        data: { vigenciaFim: fim },
      });

      return tx.proLabore.create({
        data: {
          id: uuidv7(),
          tenantId: tenantAtual(),
          valor: dados.valor,
          vigenciaInicio: inicio,
        },
      });
    });

    return this.paraResposta(criado);
  }

  /**
   * Remove uma vigência e reabre a anterior, se a removida era a atual.
   *
   * Sem reabrir, apagar o valor vigente deixaria a empresa sem pró-labore atual
   * mesmo tendo um histórico inteiro — e a sugestão passaria a comparar contra
   * nada.
   */
  async remover(id: string): Promise<void> {
    await this.prisma.comTenant(async (tx) => {
      const alvo = await tx.proLabore.findUnique({
        where: { id },
        select: { vigenciaInicio: true, vigenciaFim: true },
      });

      if (!alvo) {
        throw new NotFoundException({
          codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
          mensagem: 'Pró-labore não encontrado.',
        });
      }

      await tx.proLabore.deleteMany({ where: { id } });

      if (alvo.vigenciaFim === null) {
        const anterior = await tx.proLabore.findFirst({
          where: { vigenciaInicio: { lt: alvo.vigenciaInicio } },
          orderBy: { vigenciaInicio: 'desc' },
          select: { id: true },
        });

        if (anterior) {
          await tx.proLabore.updateMany({
            where: { id: anterior.id },
            data: { vigenciaFim: null },
          });
        }
      }
    });
  }

  /** O valor que vale hoje, ou `null` se o dono nunca definiu. */
  async vigente(): Promise<ProLabore | null> {
    const hoje = paraData(hojeEmDia())!;

    const registro = await this.prisma.comTenant((tx) =>
      tx.proLabore.findFirst({
        where: {
          vigenciaInicio: { lte: hoje },
          OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: hoje } }],
        },
        orderBy: { vigenciaInicio: 'desc' },
      }),
    );

    return registro ? this.paraResposta(registro) : null;
  }

  /**
   * Quanto dá para retirar sem descapitalizar a empresa.
   *
   * Olha para **meses fechados**: a janela termina no último dia do mês passado.
   * Incluir o mês corrente pela metade puxaria a média de receita para baixo e
   * o teto ficaria artificialmente pessimista todo começo de mês.
   *
   * Reaproveita `fluxoDeCaixa` em vez de refazer as somas — é a mesma pergunta
   * ("quanto entrou e saiu neste intervalo"), já resolvida e coberta por teste.
   */
  async sugerir(meses: number): Promise<SugestaoProLabore> {
    const de = primeiroDiaDeMesesAtras(meses);
    const ate = ultimoDiaDoMesPassado();

    const [fluxo, vigente, reservas] = await Promise.all([
      this.financeiro.fluxoDeCaixa({ de, ate, natureza: 'empresa' }),
      this.vigente(),
      this.prisma.comTenant((tx) =>
        tx.reservaFinanceira.findMany({ select: { valorAtual: true, meta: true } }),
      ),
    ]);

    const porMes = (total: string) => new Prisma.Decimal(total).dividedBy(meses);

    const mediaReceita = porMes(fluxo.entradas);
    const custoFixoMensal = porMes(fluxo.custoFixo);
    const custoVariavelMensal = porMes(fluxo.custoVariavel);

    // O quanto falta para as metas, diluído num ano. Reservas sem meta não
    // pedem aporte: não há alvo do qual calcular a distância.
    const faltaParaMetas = reservas.reduce((soma, reserva) => {
      if (!reserva.meta) return soma;

      const falta = reserva.meta.minus(reserva.valorAtual);
      return falta.greaterThan(ZERO) ? soma.plus(falta) : soma;
    }, ZERO);

    const aporteReservaSugerido = faltaParaMetas.dividedBy(MESES_PARA_COMPLETAR_RESERVA);

    const teto = mediaReceita
      .minus(custoFixoMensal)
      .minus(custoVariavelMensal)
      .minus(aporteReservaSugerido);

    // Piso em zero: um teto negativo já é a informação de que não há folga
    // nenhuma, e um número negativo ali seria lido como "retire menos que nada".
    const tetoSugerido = teto.greaterThan(ZERO) ? teto : ZERO;

    return {
      valorVigente: vigente?.valor ?? null,
      mediaReceita: mediaReceita.toFixed(2),
      custoFixoMensal: custoFixoMensal.toFixed(2),
      custoVariavelMensal: custoVariavelMensal.toFixed(2),
      aporteReservaSugerido: aporteReservaSugerido.toFixed(2),
      tetoSugerido: tetoSugerido.toFixed(2),
      folga: tetoSugerido.minus(vigente?.valor ?? ZERO).toFixed(2),
      mesesAnalisados: meses,
    };
  }

  private paraResposta(registro: Prisma.ProLaboreGetPayload<object>): ProLabore {
    return {
      id: registro.id,
      valor: registro.valor.toFixed(2),
      vigenciaInicio: paraDia(registro.vigenciaInicio)!,
      vigenciaFim: paraDia(registro.vigenciaFim),
      criadoEm: registro.criadoEm.toISOString(),
    };
  }
}
