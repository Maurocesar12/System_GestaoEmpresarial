import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CODIGOS_ERRO,
  type MovimentacaoFormInput,
  type Reserva,
  type ReservaFormInput,
  type ResumoReservas,
} from '@gestao/shared-types';
import { uuidv7 } from '../../common/uuid';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService, type TransacaoComTenant } from '../../infra/prisma/prisma.service';
import { tenantAtual } from '../../infra/tenant/tenant-context';
import { ZERO } from './decimal';
import { primeiroDiaDeMesesAtras, ultimoDiaDoMesPassado } from './datas';
import { FinanceiroService } from './financeiro.service';

/** Quantos meses fechados entram na média do custo fixo mensal. */
const MESES_DA_MEDIA = 3;

/**
 * Reserva financeira — o fundo de emergência.
 *
 * O saldo é só metade da resposta. A outra metade é a divisão dele pelo custo
 * fixo mensal: "R$ 18.000 guardados" não diz nada, "cobre 2,4 meses parado" diz
 * tudo. Por isso o resumo carrega o custo fixo junto.
 */
@Injectable()
export class ReservasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeiro: FinanceiroService,
  ) {}

  /**
   * As reservas com a leitura que interessa.
   *
   * O custo fixo vem da média dos últimos meses fechados, não do mês corrente:
   * no dia 2 o mês mal começou, e dividir por um custo quase zero devolveria
   * uma cobertura de centenas de meses.
   */
  async resumir(): Promise<ResumoReservas> {
    const [registros, fluxo] = await Promise.all([
      this.prisma.comTenant((tx) => tx.reservaFinanceira.findMany({ orderBy: { nome: 'asc' } })),
      this.financeiro.fluxoDeCaixa({
        de: primeiroDiaDeMesesAtras(MESES_DA_MEDIA),
        ate: ultimoDiaDoMesPassado(),
        natureza: 'empresa',
      }),
    ]);

    const totalGuardado = registros.reduce((soma, r) => soma.plus(r.valorAtual), ZERO);
    const totalDasMetas = registros.reduce((soma, r) => soma.plus(r.meta ?? ZERO), ZERO);

    const custoFixoMensal = new Prisma.Decimal(fluxo.custoFixo).dividedBy(MESES_DA_MEDIA);

    return {
      reservas: registros.map((registro) => this.paraResposta(registro)),
      totalGuardado: totalGuardado.toFixed(2),
      totalDasMetas: totalDasMetas.toFixed(2),
      custoFixoMensal: custoFixoMensal.toFixed(2),

      // Sem custo fixo registrado não há como responder — e "infinito" seria
      // uma resposta falsa, não uma otimista.
      mesesDeCobertura: custoFixoMensal.isZero()
        ? null
        : Number(totalGuardado.dividedBy(custoFixoMensal).toFixed(1)),
    };
  }

  async criar(dados: ReservaFormInput): Promise<Reserva> {
    const reserva = await this.prisma.comTenant(async (tx) => {
      const existente = await tx.reservaFinanceira.findFirst({
        where: { nome: dados.nome },
        select: { id: true },
      });

      if (existente) {
        throw new ConflictException({
          codigo: CODIGOS_ERRO.CONFLITO,
          mensagem: 'Já existe uma reserva com este nome.',
        });
      }

      return tx.reservaFinanceira.create({
        data: {
          id: uuidv7(),
          tenantId: tenantAtual(),
          nome: dados.nome,
          valorAtual: dados.valorAtual,
          meta: dados.meta,
        },
      });
    });

    return this.paraResposta(reserva);
  }

  async atualizar(id: string, dados: ReservaFormInput): Promise<Reserva> {
    const reserva = await this.prisma.comTenant(async (tx) => {
      // A existência vem primeiro. Na ordem inversa, atualizar um id que não
      // existe usando um nome já ocupado responderia 409 "já existe uma reserva
      // com este nome" — uma mensagem sobre o recurso errado, quando a resposta
      // correta é 404.
      await this.garantirExiste(tx, id);

      const existente = await tx.reservaFinanceira.findFirst({
        where: { nome: dados.nome, id: { not: id } },
        select: { id: true },
      });

      if (existente) {
        throw new ConflictException({
          codigo: CODIGOS_ERRO.CONFLITO,
          mensagem: 'Já existe uma reserva com este nome.',
        });
      }

      return tx.reservaFinanceira.update({
        where: { id },
        data: { nome: dados.nome, valorAtual: dados.valorAtual, meta: dados.meta },
      });
    });

    return this.paraResposta(reserva);
  }

  /**
   * Guarda ou resgata um valor.
   *
   * Existe em vez de obrigar a editar o saldo direto porque quem guarda R$ 500
   * pensa em "guardei quinhentos", não em "o novo total é 18.500" — e fazer a
   * conta de cabeça é onde entra o erro de digitação.
   *
   * A leitura e a escrita ficam na mesma transação: duas movimentações
   * simultâneas lendo o mesmo saldo antigo fariam a segunda apagar a primeira.
   */
  async movimentar(id: string, dados: MovimentacaoFormInput): Promise<Reserva> {
    const reserva = await this.prisma.comTenant(async (tx) => {
      const atual = await tx.reservaFinanceira.findUnique({
        where: { id },
        select: { valorAtual: true },
      });

      if (!atual) {
        throw new NotFoundException({
          codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
          mensagem: 'Reserva não encontrada.',
        });
      }

      const valor = new Prisma.Decimal(dados.valor);
      const novo =
        dados.tipo === 'aporte' ? atual.valorAtual.plus(valor) : atual.valorAtual.minus(valor);

      if (novo.lessThan(ZERO)) {
        throw new BadRequestException({
          codigo: CODIGOS_ERRO.CONFLITO,
          mensagem: `Esta reserva tem R$ ${atual.valorAtual.toFixed(2)}. Não é possível resgatar mais do que há guardado.`,
        });
      }

      return tx.reservaFinanceira.update({ where: { id }, data: { valorAtual: novo } });
    });

    return this.paraResposta(reserva);
  }

  async remover(id: string): Promise<void> {
    const { count } = await this.prisma.comTenant((tx) =>
      tx.reservaFinanceira.deleteMany({ where: { id } }),
    );

    if (count === 0) {
      throw new NotFoundException({
        codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
        mensagem: 'Reserva não encontrada.',
      });
    }
  }

  private async garantirExiste(tx: TransacaoComTenant, id: string): Promise<void> {
    const existe = await tx.reservaFinanceira.findUnique({ where: { id }, select: { id: true } });

    if (!existe) {
      throw new NotFoundException({
        codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
        mensagem: 'Reserva não encontrada.',
      });
    }
  }

  private paraResposta(registro: Prisma.ReservaFinanceiraGetPayload<object>): Reserva {
    return {
      id: registro.id,
      nome: registro.nome,
      valorAtual: registro.valorAtual.toFixed(2),
      meta: registro.meta?.toFixed(2) ?? null,

      // Passa de 100 quando o dono guardou além da meta — e isso é informação,
      // não erro: limitar em 100 esconderia que ele já superou o alvo.
      percentualDaMeta:
        registro.meta && !registro.meta.isZero()
          ? Number(registro.valorAtual.dividedBy(registro.meta).times(100).toFixed(0))
          : null,

      criadoEm: registro.criadoEm.toISOString(),
      atualizadoEm: registro.atualizadoEm.toISOString(),
    };
  }
}
