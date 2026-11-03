import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CODIGOS_ERRO,
  type MovimentacaoFormInput,
  type Reserva,
  type ReservaFormInput,
  type ResumoReservas,
  type SimulacaoReserva,
  type SimulacaoReservaInput,
} from '@gestao/shared-types';
import { uuidv7 } from '../../common/uuid';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService, type TransacaoComTenant } from '../../infra/prisma/prisma.service';
import { tenantAtual } from '../../infra/tenant/tenant-context';
import { ZERO } from './decimal';
import { primeiroDiaDeMesesAtras, ultimoDiaDoMesPassado } from './datas';
import { FinanceiroService } from './financeiro.service';
import { AuditoriaService } from '../plataforma/auditoria/auditoria.service';
import { naoEncontrado, conflito } from '../../common/erros';
import {
  MENSAGEM_VERSAO,
  VERSAO_SUBIU,
  filtroDeVersao,
  gravarSeNaoMudou,
} from '../../common/concorrencia';

/** Quantos meses fechados entram na média do custo fixo mensal. */
const MESES_DA_MEDIA = 3;

/** Aporte de partida da simulação quando a reserva não tem meta. */
const APORTE_SUGERIDO_SEM_META = '500.00';

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
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * As reservas com a leitura que interessa.
   *
   * O custo fixo vem da média dos últimos meses fechados, não do mês corrente:
   * no dia 2 o mês mal começou, e dividir por um custo quase zero devolveria
   * uma cobertura de centenas de meses.
   */
  async resumir(): Promise<ResumoReservas> {
    const [registros, custoFixoMensal] = await Promise.all([
      this.prisma.comTenant((tx) => tx.reservaFinanceira.findMany({ orderBy: { nome: 'asc' } })),
      this.custoFixoMensal(),
    ]);

    const totalGuardado = registros.reduce((soma, r) => soma.plus(r.valorAtual), ZERO);
    const totalDasMetas = registros.reduce((soma, r) => soma.plus(r.meta ?? ZERO), ZERO);

    return {
      reservas: registros.map((registro) => this.paraResposta(registro)),
      totalGuardado: totalGuardado.toFixed(2),
      totalDasMetas: totalDasMetas.toFixed(2),
      faltaParaMetas: Prisma.Decimal.max(totalDasMetas.minus(totalGuardado), ZERO).toFixed(2),
      custoFixoMensal: custoFixoMensal.toFixed(2),

      // Sem custo fixo registrado não há como responder — e "infinito" seria
      // uma resposta falsa, não uma otimista.
      mesesDeCobertura: custoFixoMensal.isZero()
        ? null
        : Number(totalGuardado.dividedBy(custoFixoMensal).toFixed(1)),
    };
  }

  /**
   * "Guardando X por mês durante N meses, onde chego?" — ver `SimulacaoReserva`.
   * Não grava nada; saldo, meta e custo fixo vêm do banco.
   */
  async simular(id: string, dados: SimulacaoReservaInput): Promise<SimulacaoReserva> {
    const [reserva, custoFixoMensal] = await Promise.all([
      this.prisma.comTenant((tx) =>
        tx.reservaFinanceira.findUnique({
          where: { id },
          select: { valorAtual: true, meta: true },
        }),
      ),
      this.custoFixoMensal(),
    ]);

    if (!reserva) {
      throw naoEncontrado('Reserva não encontrada.');
    }

    // Aporte negativo não é aporte: seria uma retirada, que tem fluxo próprio.
    const aporte = Prisma.Decimal.max(new Prisma.Decimal(dados.aporteMensal), ZERO);
    const totalAportado = aporte.times(dados.meses);
    const saldoPrevisto = reserva.valorAtual.plus(totalAportado);
    const meta = reserva.meta;

    return {
      totalAportado: totalAportado.toFixed(2),
      saldoPrevisto: saldoPrevisto.toFixed(2),
      faltaParaMeta: meta ? Prisma.Decimal.max(meta.minus(saldoPrevisto), ZERO).toFixed(2) : null,
      mesesParaMeta:
        meta && aporte.greaterThan(ZERO) && reserva.valorAtual.lessThan(meta)
          ? meta.minus(reserva.valorAtual).dividedBy(aporte).ceil().toNumber()
          : null,
      mesesDeCobertura: custoFixoMensal.isZero()
        ? null
        : Number(saldoPrevisto.dividedBy(custoFixoMensal).toFixed(1)),
    };
  }

  /**
   * Custo fixo médio dos últimos meses fechados, não do mês corrente: no dia 2
   * o mês mal começou, e dividir por um custo quase zero devolveria uma
   * cobertura de centenas de meses.
   */
  private async custoFixoMensal(): Promise<Prisma.Decimal> {
    const fluxo = await this.financeiro.fluxoDeCaixa({
      de: primeiroDiaDeMesesAtras(MESES_DA_MEDIA),
      ate: ultimoDiaDoMesPassado(),
      natureza: 'empresa',
    });

    return new Prisma.Decimal(fluxo.custoFixo).dividedBy(MESES_DA_MEDIA);
  }

  /** O schema aceita sinal; reserva negativa não existe (e o banco também recusa). */
  private exigirSaldoNaoNegativo(valorAtual: string): void {
    if (new Prisma.Decimal(valorAtual).lessThan(ZERO)) {
      throw new BadRequestException({
        codigo: CODIGOS_ERRO.VALIDACAO,
        mensagem: 'O valor guardado não pode ser negativo.',
      });
    }
  }

  async criar(dados: ReservaFormInput): Promise<Reserva> {
    this.exigirSaldoNaoNegativo(dados.valorAtual);

    const reserva = await this.prisma.comTenant(async (tx) => {
      const existente = await tx.reservaFinanceira.findFirst({
        where: { nome: dados.nome },
        select: { id: true },
      });

      if (existente) {
        throw conflito('Já existe uma reserva com este nome.');
      }

      const criada = await tx.reservaFinanceira.create({
        data: {
          id: uuidv7(),
          tenantId: tenantAtual(),
          nome: dados.nome,
          valorAtual: dados.valorAtual,
          meta: dados.meta,
        },
      });

      await this.auditoria.registrar(tx, {
        entidade: 'reserva',
        entidadeId: criada.id,
        acao: 'criou',
        resumo: this.resumirReserva('Reserva criada', criada),
        depois: this.paraResposta(criada),
      });

      return criada;
    });

    return this.paraResposta(reserva);
  }

  /** @param versao A versão que a tela abriu (`If-Match`); se mudou, 409. */
  async atualizar(id: string, dados: ReservaFormInput, versao?: number): Promise<Reserva> {
    this.exigirSaldoNaoNegativo(dados.valorAtual);

    const reserva = await this.prisma.comTenant(async (tx) => {
      // A existência vem primeiro. Na ordem inversa, atualizar um id que não
      // existe usando um nome já ocupado responderia 409 "já existe uma reserva
      // com este nome" — uma mensagem sobre o recurso errado, quando a resposta
      // correta é 404.
      const anterior = await this.buscarOuFalhar(tx, id);

      const existente = await tx.reservaFinanceira.findFirst({
        where: { nome: dados.nome, id: { not: id } },
        select: { id: true },
      });

      if (existente) {
        throw conflito('Já existe uma reserva com este nome.');
      }

      // Reescrever o saldo digitado por cima de um aporte ou resgate que entrou
      // depois da leitura apagaria essa movimentação: só grava se o saldo ainda
      // é o que foi lido aqui (cobre quem não mandou a versão) e, quando a tela
      // mandou, se a reserva segue na versão que ela abriu (aporte, resgate e
      // outra edição sobem a versão).
      const alterada = await gravarSeNaoMudou(
        tx.reservaFinanceira.update({
          where: { id, valorAtual: anterior.valorAtual, ...filtroDeVersao(versao) },
          data: {
            ...VERSAO_SUBIU,
            nome: dados.nome,
            valorAtual: dados.valorAtual,
            meta: dados.meta,
          },
        }),
        MENSAGEM_VERSAO,
      );

      await this.auditoria.registrar(tx, {
        entidade: 'reserva',
        entidadeId: id,
        acao: 'alterou',
        resumo: this.resumirReserva('Reserva alterada', alterada),
        antes: this.paraResposta(anterior),
        depois: this.paraResposta(alterada),
      });

      return alterada;
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
   * A conta é feita pelo banco (`increment`/`decrement`), não aqui: ler o saldo,
   * somar e gravar de volta, mesmo na mesma transação, deixa duas movimentações
   * simultâneas partirem do mesmo saldo antigo — a segunda apagaria a primeira.
   * No resgate, "há saldo suficiente" vai no `where` do mesmo `UPDATE`, então
   * dois resgates que juntos estourariam o saldo não passam os dois.
   */
  async movimentar(id: string, dados: MovimentacaoFormInput): Promise<Reserva> {
    const valor = new Prisma.Decimal(dados.valor);

    // O schema aceita sinal; um resgate de "-100" aumentaria o saldo.
    if (!valor.greaterThan(ZERO)) {
      throw new BadRequestException({
        codigo: CODIGOS_ERRO.VALIDACAO,
        mensagem: 'Informe um valor maior que zero.',
      });
    }

    const reserva = await this.prisma.comTenant(async (tx) => {
      const resgate = dados.tipo === 'resgate';

      const { count } = await tx.reservaFinanceira.updateMany({
        where: resgate ? { id, valorAtual: { gte: valor } } : { id },
        // Sobe a versão: a tela de edição da reserva reescreve o saldo, e uma
        // aberta antes desta movimentação a apagaria ao salvar.
        data: {
          valorAtual: resgate ? { decrement: valor } : { increment: valor },
          ...VERSAO_SUBIU,
        },
      });

      if (count === 0) {
        const existente = await tx.reservaFinanceira.findUnique({
          where: { id },
          select: { valorAtual: true },
        });

        if (!existente) {
          throw naoEncontrado('Reserva não encontrada.');
        }

        throw new BadRequestException({
          codigo: CODIGOS_ERRO.CONFLITO,
          mensagem: `Esta reserva tem R$ ${existente.valorAtual.toFixed(2)}. Não é possível resgatar mais do que há guardado.`,
        });
      }

      // A linha está travada por esta transação desde o UPDATE: o que se lê
      // aqui é exatamente o saldo gravado.
      const alterada = await tx.reservaFinanceira.findUniqueOrThrow({ where: { id } });
      const saldoAnterior = resgate
        ? alterada.valorAtual.plus(valor)
        : alterada.valorAtual.minus(valor);

      await this.auditoria.registrar(tx, {
        entidade: 'reserva',
        entidadeId: id,
        acao: 'movimentou',
        resumo: `${dados.tipo === 'aporte' ? 'Aporte' : 'Resgate'} em reserva: ${alterada.nome} · R$ ${valor.toFixed(2)} · saldo R$ ${alterada.valorAtual.toFixed(2)}`,
        antes: this.paraResposta({ ...alterada, valorAtual: saldoAnterior }),
        depois: this.paraResposta(alterada),
      });

      return alterada;
    });

    return this.paraResposta(reserva);
  }

  async remover(id: string): Promise<void> {
    const { count } = await this.prisma.comTenant(async (tx) => {
      const anterior = await tx.reservaFinanceira.findUnique({ where: { id } });
      const resultado = await tx.reservaFinanceira.deleteMany({ where: { id } });

      if (anterior && resultado.count) {
        await this.auditoria.registrar(tx, {
          entidade: 'reserva',
          entidadeId: id,
          acao: 'excluiu',
          resumo: this.resumirReserva('Reserva excluída', anterior),
          antes: this.paraResposta(anterior),
        });
      }

      return resultado;
    });

    if (count === 0) {
      throw naoEncontrado('Reserva não encontrada.');
    }
  }

  private async buscarOuFalhar(
    tx: TransacaoComTenant,
    id: string,
  ): Promise<Prisma.ReservaFinanceiraGetPayload<object>> {
    const existe = await tx.reservaFinanceira.findUnique({ where: { id }, select: { id: true } });

    if (!existe) {
      throw naoEncontrado('Reserva não encontrada.');
    }

    return tx.reservaFinanceira.findUniqueOrThrow({ where: { id } });
  }

  private paraResposta(registro: Prisma.ReservaFinanceiraGetPayload<object>): Reserva {
    return {
      id: registro.id,
      versao: registro.versao,
      nome: registro.nome,
      valorAtual: registro.valorAtual.toFixed(2),
      meta: registro.meta?.toFixed(2) ?? null,

      // Passa de 100 quando o dono guardou além da meta — e isso é informação,
      // não erro: limitar em 100 esconderia que ele já superou o alvo.
      percentualDaMeta:
        registro.meta && !registro.meta.isZero()
          ? Number(registro.valorAtual.dividedBy(registro.meta).times(100).toFixed(0))
          : null,

      // O que falta, dividido em um ano, arredondado para cima no centavo —
      // seguir a sugestão nunca deixa a meta a um centavo de distância.
      aporteSugerido:
        registro.meta && registro.meta.greaterThan(registro.valorAtual)
          ? registro.meta
              .minus(registro.valorAtual)
              .dividedBy(12)
              .toDecimalPlaces(2, Prisma.Decimal.ROUND_UP)
              .toFixed(2)
          : APORTE_SUGERIDO_SEM_META,

      criadoEm: registro.criadoEm.toISOString(),
      atualizadoEm: registro.atualizadoEm.toISOString(),
    };
  }

  private resumirReserva(
    prefixo: string,
    registro: Prisma.ReservaFinanceiraGetPayload<object>,
  ): string {
    const meta = registro.meta ? ` · meta R$ ${registro.meta.toFixed(2)}` : '';
    return `${prefixo}: ${registro.nome} · saldo R$ ${registro.valorAtual.toFixed(2)}${meta}`;
  }
}
