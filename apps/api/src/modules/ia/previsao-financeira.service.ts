import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import {
  CODIGOS_ERRO,
  PACOTE_IA_PRECO_MENSAL_BRL,
  type BaseDaPrevisao,
  type ConsumoIaResponse,
  type GerarPrevisaoFinanceiraInput,
  type MesFinanceiro,
  type MesProjetado,
  type PrevisaoFinanceiraResponse,
} from '@gestao/shared-types';
import type { Env } from '../../config/env.schema';
import { Prisma } from '../../generated/prisma/client';
import { AssistenteIa } from '../../infra/ia/assistente-ia';
import { PrismaService, type TransacaoComTenant } from '../../infra/prisma/prisma.service';
import { exigirContextoTenant, tenantAtual } from '../../infra/tenant/tenant-context';
import { AuditoriaService } from '../plataforma/auditoria/auditoria.service';

interface DadosCalculados {
  saldoAtual: string;
  historico: MesFinanceiro[];
  projecoes: MesProjetado[];
  /** Ausente nas previsões gravadas antes desta versão. */
  negocio?: BaseDaPrevisao;
}

interface ReservaPrevisao {
  id: string;
  usado: number;
  limite: number | null;
}

/**
 * Previsão financeira.
 *
 * ## Recurso de plano, e não de cota
 *
 * Antes, todo plano gerava três previsões por mês com uma análise local por
 * regras — e o texto saía com cara de IA. Era pior que não ter: quem lia
 * achava que tinha uma projeção analisada quando tinha a média dos últimos
 * meses. A previsão passou a ser exclusiva do Premium, e a análise local virou
 * só a rede de segurança para quando o fornecedor não responde.
 *
 * ## O que entra na conta
 *
 * O extrato responde de onde a empresa veio; ele sozinho não responde para onde
 * ela vai. Por isso a projeção considera também o funil (propostas em aberto
 * ponderadas pela conversão da própria empresa), os serviços já agendados, o
 * pró-labore vigente e as contas vencidas. O que é dinheiro **combinado** e o
 * que é dinheiro **possível** viajam em campos separados — somá-los na mesma
 * linha esconderia justamente a diferença que muda uma decisão.
 */
@Injectable()
export class PrevisaoFinanceiraService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assistente: AssistenteIa,
    private readonly config: ConfigService<Env, true>,
    private readonly auditoria: AuditoriaService,
  ) {}

  async ultima(): Promise<PrevisaoFinanceiraResponse | null> {
    const inicio = inicioMes(new Date());
    const dados = await this.prisma.comTenant(async (tx) => {
      const [previsao, tenant, usado] = await Promise.all([
        tx.previsaoFinanceira.findFirst({
          where: { modelo: { not: 'processando' } },
          orderBy: { criadoEm: 'desc' },
        }),
        tx.tenant.findUniqueOrThrow({ where: { id: tenantAtual() }, include: { plano: true } }),
        tx.previsaoFinanceira.count({
          where: { criadoEm: { gte: inicio }, modelo: { not: 'processando' } },
        }),
      ]);
      return { previsao, limite: limitePrevisoesIa(tenant.plano), usado };
    });
    if (!dados.previsao) return null;

    const base = dados.previsao.dadosBase as unknown as DadosCalculados;
    return {
      id: dados.previsao.id,
      geradoEm: dados.previsao.criadoEm.toISOString(),
      modo: dados.previsao.modo,
      modelo: dados.previsao.modelo,
      aviso: AVISO_PREVISAO,
      historico: base.historico,
      projecoes: base.projecoes,
      analise: dados.previsao.resultado as unknown as PrevisaoFinanceiraResponse['analise'],
      baseDeDados: base.negocio,
      consumo: {
        inputTokens: dados.previsao.inputTokens,
        outputTokens: dados.previsao.outputTokens,
        custoEstimadoUsd: dados.previsao.custoEstimadoUsd.toFixed(6),
      },
      quota: { usado: dados.usado, limite: dados.limite },
    };
  }

  async consumoDoMes(): Promise<ConsumoIaResponse> {
    const inicio = inicioMes(new Date());
    const registros = await this.prisma.comTenant(async (tx) => {
      const previsoes = await tx.previsaoFinanceira.findMany({
        where: { criadoEm: { gte: inicio }, modelo: { not: 'processando' } },
        select: {
          usuarioId: true,
          inputTokens: true,
          outputTokens: true,
          custoEstimadoUsd: true,
        },
      });
      const ids = [...new Set(previsoes.map((item) => item.usuarioId))];
      const usuarios = await tx.usuario.findMany({
        where: { id: { in: ids } },
        select: { id: true, nome: true },
      });
      return { previsoes, nomes: new Map(usuarios.map((item) => [item.id, item.nome])) };
    });

    const agrupado = new Map<
      string,
      {
        usuarioNome: string;
        previsoes: number;
        inputTokens: number;
        outputTokens: number;
        custo: number;
      }
    >();
    for (const item of registros.previsoes) {
      const atual = agrupado.get(item.usuarioId) ?? {
        usuarioNome: registros.nomes.get(item.usuarioId) ?? 'Usuário removido',
        previsoes: 0,
        inputTokens: 0,
        outputTokens: 0,
        custo: 0,
      };
      atual.previsoes += 1;
      atual.inputTokens += item.inputTokens;
      atual.outputTokens += item.outputTokens;
      atual.custo += Number(item.custoEstimadoUsd);
      agrupado.set(item.usuarioId, atual);
    }

    const porUsuario = [...agrupado.entries()].map(([usuarioId, item]) => ({
      usuarioId,
      usuarioNome: item.usuarioNome,
      previsoes: item.previsoes,
      inputTokens: item.inputTokens,
      outputTokens: item.outputTokens,
      custoEstimadoUsd: item.custo.toFixed(6),
    }));
    return {
      periodo: chaveMes(inicio),
      totalPrevisoes: registros.previsoes.length,
      inputTokens: porUsuario.reduce((total, item) => total + item.inputTokens, 0),
      outputTokens: porUsuario.reduce((total, item) => total + item.outputTokens, 0),
      custoEstimadoUsd: porUsuario
        .reduce((total, item) => total + Number(item.custoEstimadoUsd), 0)
        .toFixed(6),
      porUsuario,
    };
  }

  async gerar(dados: GerarPrevisaoFinanceiraInput): Promise<PrevisaoFinanceiraResponse> {
    const tenantId = tenantAtual();
    const usuarioId = exigirContextoTenant().usuarioId;
    const calculados = await this.calcular(dados);
    const reserva = await this.reservar(tenantId, usuarioId, dados, calculados);
    const identificadorSeguro = createHash('sha256')
      .update(`${tenantId}:${usuarioId}`)
      .digest('hex');

    const resultado = await this.assistente.analisarPrevisao({
      identificadorSeguro,
      saldoAtual: calculados.saldoAtual,
      historico: calculados.historico,
      projecoes: calculados.projecoes,
      negocio: calculados.negocio!,
    });
    const custo =
      (resultado.inputTokens * this.config.get('OPENAI_CUSTO_INPUT_USD_MILHAO', { infer: true }) +
        resultado.outputTokens *
          this.config.get('OPENAI_CUSTO_OUTPUT_USD_MILHAO', { infer: true })) /
      1_000_000;

    const salvo = await this.prisma.comTenant(async (tx) => {
      const previsao = await tx.previsaoFinanceira.update({
        where: { id: reserva.id },
        data: {
          modo: resultado.modo,
          modelo: resultado.modelo,
          resultado: resultado.analise as unknown as Prisma.InputJsonValue,
          inputTokens: resultado.inputTokens,
          outputTokens: resultado.outputTokens,
          custoEstimadoUsd: new Prisma.Decimal(custo),
        },
      });
      await this.auditoria.registrar(tx, {
        entidade: 'previsao_financeira',
        entidadeId: previsao.id,
        acao: 'criou',
        depois: { modo: resultado.modo, modelo: resultado.modelo },
      });
      return previsao;
    });

    return {
      id: salvo.id,
      geradoEm: salvo.criadoEm.toISOString(),
      modo: resultado.modo,
      modelo: resultado.modelo,
      aviso: AVISO_PREVISAO,
      historico: calculados.historico,
      projecoes: calculados.projecoes,
      analise: resultado.analise,
      baseDeDados: calculados.negocio,
      consumo: {
        inputTokens: resultado.inputTokens,
        outputTokens: resultado.outputTokens,
        custoEstimadoUsd: custo.toFixed(6),
      },
      quota: { usado: reserva.usado, limite: reserva.limite },
    };
  }

  private async reservar(
    tenantId: string,
    usuarioId: string,
    dados: GerarPrevisaoFinanceiraInput,
    calculados: DadosCalculados,
  ): Promise<ReservaPrevisao> {
    const inicioDoMes = inicioMes(new Date());
    // Uma geração em andamento ocupa cota para impedir cliques concorrentes de
    // ultrapassarem o limite. Se o processo cair, a reserva envelhece em dez
    // minutos e deixa de bloquear novas previsões.
    const processandoDesde = new Date(Date.now() - 10 * 60 * 1000);
    return this.prisma.comTenant(async (tx) => {
      await tx.$executeRaw`SELECT id FROM tenant WHERE id = ${tenantId}::uuid FOR UPDATE`;
      const tenant = await tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        include: { plano: true },
      });

      // A porta do recurso. Antes daqui, qualquer plano gerava previsões com
      // uma análise local disfarçada de IA; hoje quem não tem o Premium recebe
      // um convite claro em vez de um resultado em que não deveria confiar.
      if (!tenant.plano.iaHabilitada) {
        throw new ForbiddenException({
          codigo: CODIGOS_ERRO.LIMITE_PLANO_EXCEDIDO,
          mensagem:
            `A previsão financeira com IA faz parte do plano Premium (R$ ${PACOTE_IA_PRECO_MENSAL_BRL}/mês). ` +
            `O plano ${tenant.plano.nome} continua com o fluxo de caixa, a margem por serviço e o assistente de ajuda do sistema.`,
        });
      }

      const usado = await tx.previsaoFinanceira.count({
        where: {
          criadoEm: { gte: inicioDoMes },
          OR: [
            { modelo: { not: 'processando' } },
            { modelo: 'processando', criadoEm: { gte: processandoDesde } },
          ],
        },
      });
      const limite = limitePrevisoesIa(tenant.plano);
      if (limite !== null && usado >= limite) {
        throw new ForbiddenException({
          codigo: CODIGOS_ERRO.LIMITE_PLANO_EXCEDIDO,
          mensagem: 'O limite mensal de previsões do plano foi atingido.',
        });
      }
      const previsao = await tx.previsaoFinanceira.create({
        data: {
          tenantId,
          usuarioId,
          mesesHistorico: dados.mesesHistorico,
          mesesProjecao: dados.mesesProjecao,
          modo: 'demonstracao',
          modelo: 'processando',
          dadosBase: calculados as unknown as Prisma.InputJsonValue,
          resultado: { status: 'processando' },
        },
      });
      return { id: previsao.id, usado: usado + 1, limite };
    });
  }

  /**
   * Monta a base da previsão.
   *
   * Duas metades: o **caixa** (histórico pago e contas futuras registradas) e o
   * **negócio** (funil, conversão, agenda, pró-labore, vencidos, maiores
   * saídas). A primeira projeta o que já está contratado; a segunda é o que
   * permite à análise dizer por que o mês que vem pode ser diferente do
   * passado.
   */
  private async calcular(dados: GerarPrevisaoFinanceiraInput): Promise<DadosCalculados> {
    const agora = new Date();
    const inicioAtual = inicioMes(agora);
    const inicioHistorico = somarMeses(inicioAtual, -dados.mesesHistorico);
    const inicioProjecao = somarMeses(inicioAtual, 1);
    const fimProjecao = somarMeses(inicioProjecao, dados.mesesProjecao);
    const hojeUtc = new Date(
      Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()),
    );

    const dadosDoBanco = await this.prisma.comTenant(async (tx) => {
      const [pagos, futuros, todasEntradas, todasSaidas, negocio] = await Promise.all([
        tx.lancamentoFinanceiro.findMany({
          where: {
            natureza: 'empresa',
            pagoEm: { gte: inicioHistorico, lt: inicioAtual },
          },
          select: { tipo: true, valor: true, pagoEm: true },
        }),
        tx.lancamentoFinanceiro.findMany({
          where: {
            natureza: 'empresa',
            pagoEm: null,
            OR: [
              { vencimento: { gte: inicioProjecao, lt: fimProjecao } },
              { vencimento: null, data: { gte: inicioProjecao, lt: fimProjecao } },
            ],
          },
          select: { tipo: true, valor: true, vencimento: true, data: true },
        }),
        tx.lancamentoFinanceiro.aggregate({
          where: { natureza: 'empresa', tipo: 'entrada', pagoEm: { not: null } },
          _sum: { valor: true },
        }),
        tx.lancamentoFinanceiro.aggregate({
          where: { natureza: 'empresa', tipo: 'saida', pagoEm: { not: null } },
          _sum: { valor: true },
        }),
        this.retratoDoNegocio(tx, { inicioHistorico, agora, hojeUtc, dados }),
      ]);

      return { pagos, futuros, todasEntradas, todasSaidas, negocio };
    });

    const { pagos, futuros, todasEntradas, todasSaidas, negocio } = dadosDoBanco;

    const historico = Array.from({ length: dados.mesesHistorico }, (_, indice) => {
      const data = somarMeses(inicioHistorico, indice);
      const chave = chaveMes(data);
      const doMes = pagos.filter((item) => item.pagoEm && chaveMes(item.pagoEm) === chave);
      const entradas = somar(doMes.filter((item) => item.tipo === 'entrada'));
      const saidas = somar(doMes.filter((item) => item.tipo === 'saida'));
      return {
        mes: chave,
        entradas: moeda(entradas),
        saidas: moeda(saidas),
        saldo: moeda(entradas.minus(saidas)),
      };
    });

    const mediaEntradas = mediaPonderada(
      historico.map((item) => new Prisma.Decimal(item.entradas)),
    );
    const mediaSaidas = mediaPonderada(historico.map((item) => new Prisma.Decimal(item.saidas)));
    const saldoAtual = new Prisma.Decimal(todasEntradas._sum.valor ?? 0).minus(
      todasSaidas._sum.valor ?? 0,
    );
    const recorrentes = new Prisma.Decimal(negocio.compromissosRecorrentes);

    let acumulado = saldoAtual;
    const projecoes = Array.from({ length: dados.mesesProjecao }, (_, indice): MesProjetado => {
      const data = somarMeses(inicioProjecao, indice);
      const chave = chaveMes(data);
      const conhecidos = futuros.filter((item) => chaveMes(item.vencimento ?? item.data) === chave);
      const receber = somar(conhecidos.filter((item) => item.tipo === 'entrada'));
      const pagar = somar(conhecidos.filter((item) => item.tipo === 'saida'));
      const entradas = maiorDecimal(mediaEntradas, receber);

      // O pró-labore entra como piso das saídas, e não como parcela somada:
      // quem já o registra como lançamento o tem dentro da média, e somar de
      // novo cobraria a retirada duas vezes. Como piso, ele só aparece quando o
      // mês projetado ficaria abaixo de um compromisso que existe de qualquer
      // jeito.
      const saidas = maiorDecimal(maiorDecimal(mediaSaidas, pagar), recorrentes);

      acumulado = acumulado.plus(entradas.minus(saidas));

      return {
        mes: chave,
        entradas: moeda(entradas),
        saidas: moeda(saidas),
        saldo: moeda(entradas.minus(saidas)),
        saldoAcumulado: moeda(acumulado),
        contasAReceberConhecidas: moeda(receber),
        contasAPagarConhecidas: moeda(pagar),
        // Fora do saldo de propósito: é dinheiro possível, não combinado. A
        // média histórica já embute as vendas que costumam fechar, então somar
        // o funil aqui contaria a mesma receita duas vezes.
        receitaProvavelFunil: moeda(
          indice === 0
            ? new Prisma.Decimal(negocio.propostasAbertas.valor).times(negocio.taxaConversao)
            : ZERO,
        ),
        compromissosRecorrentes: moeda(recorrentes),
      };
    });

    return { saldoAtual: moeda(saldoAtual), historico, projecoes, negocio };
  }

  /**
   * O negócio além do extrato.
   *
   * Tudo em agregados — contagens, somas e médias. Nenhum nome de cliente e
   * nenhuma descrição saem daqui, porque este objeto é justamente o que segue
   * para o fornecedor de IA.
   */
  private async retratoDoNegocio(
    tx: TransacaoComTenant,
    janela: {
      inicioHistorico: Date;
      agora: Date;
      hojeUtc: Date;
      dados: GerarPrevisaoFinanceiraInput;
    },
  ): Promise<BaseDaPrevisao> {
    const [
      lancamentos,
      clientes,
      abertos,
      respondidos,
      ticket,
      agendamentos,
      proLabore,
      vencidas,
      saidasPorCategoria,
    ] = await Promise.all([
      tx.lancamentoFinanceiro.count({
        where: { natureza: 'empresa', pagoEm: { gte: janela.inicioHistorico } },
      }),
      tx.cliente.count({ where: { anonimizadoEm: null } }),
      tx.orcamento.aggregate({
        where: { status: 'aberto' },
        _count: { _all: true },
        _sum: { valor: true },
      }),
      tx.orcamento.groupBy({
        by: ['status'],
        where: { respondidoEm: { gte: janela.inicioHistorico } },
        _count: { _all: true },
      }),
      tx.orcamento.aggregate({ where: { status: 'aprovado' }, _avg: { valor: true } }),
      tx.agendamento.count({
        where: { dataHora: { gte: janela.agora }, status: { in: ['agendado', 'confirmado'] } },
      }),
      tx.proLabore.findFirst({
        where: { OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: janela.hojeUtc } }] },
        orderBy: { vigenciaInicio: 'desc' },
        select: { valor: true },
      }),
      tx.lancamentoFinanceiro.aggregate({
        where: { natureza: 'empresa', pagoEm: null, vencimento: { lt: janela.hojeUtc } },
        _count: { _all: true },
        _sum: { valor: true },
      }),
      tx.lancamentoFinanceiro.groupBy({
        by: ['categoriaId'],
        where: {
          natureza: 'empresa',
          tipo: 'saida',
          pagoEm: { gte: janela.inicioHistorico },
          categoriaId: { not: null },
        },
        _sum: { valor: true },
        orderBy: { _sum: { valor: 'desc' } },
        take: 5,
      }),
    ]);

    const aprovados = respondidos.find((grupo) => grupo.status === 'aprovado')?._count._all ?? 0;
    const recusados = respondidos.find((grupo) => grupo.status === 'recusado')?._count._all ?? 0;

    const categorias = await tx.categoriaFinanceira.findMany({
      where: {
        id: {
          in: saidasPorCategoria.flatMap((grupo) => (grupo.categoriaId ? [grupo.categoriaId] : [])),
        },
      },
      select: { id: true, nome: true },
    });
    const nomeDaCategoria = new Map(categorias.map((categoria) => [categoria.id, categoria.nome]));

    return {
      mesesHistorico: janela.dados.mesesHistorico,
      mesesProjecao: janela.dados.mesesProjecao,
      lancamentosAnalisados: lancamentos,
      clientesNaCarteira: clientes,
      propostasAbertas: {
        quantidade: abertos._count._all,
        valor: moeda(abertos._sum.valor ?? ZERO),
      },
      // Sobre os respondidos: incluir as propostas ainda em aberto no
      // denominador faria a taxa cair toda vez que a equipe vendesse mais.
      taxaConversao: aprovados + recusados === 0 ? 0 : aprovados / (aprovados + recusados),
      ticketMedio: moeda(ticket._avg.valor ?? ZERO),
      agendamentosFuturos: agendamentos,
      compromissosRecorrentes: moeda(proLabore?.valor ?? ZERO),
      contasVencidas: {
        quantidade: vencidas._count._all,
        valor: moeda(vencidas._sum.valor ?? ZERO),
      },
      maioresSaidas: saidasPorCategoria.map((grupo) => ({
        categoria: nomeDaCategoria.get(grupo.categoriaId ?? '') ?? 'Sem categoria',
        valor: moeda(grupo._sum.valor ?? ZERO),
      })),
    };
  }
}

const ZERO = new Prisma.Decimal(0);

const AVISO_PREVISAO =
  'Estimativa baseada nos lançamentos registrados. Não é garantia de resultado nem aconselhamento contábil.';

function inicioMes(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), 1));
}
function somarMeses(data: Date, quantidade: number): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + quantidade, 1));
}
function chaveMes(data: Date): string {
  return data.toISOString().slice(0, 7);
}
function moeda(valor: Prisma.Decimal): string {
  return valor.toFixed(2);
}
function somar(itens: Array<{ valor: Prisma.Decimal }>): Prisma.Decimal {
  return itens.reduce((total, item) => total.plus(item.valor), ZERO);
}
function mediaPonderada(valores: Prisma.Decimal[]): Prisma.Decimal {
  const pesoTotal = valores.reduce((total, _, indice) => total + indice + 1, 0);
  return pesoTotal === 0
    ? ZERO
    : valores
        .reduce((total, valor, indice) => total.plus(valor.times(indice + 1)), ZERO)
        .dividedBy(pesoTotal);
}
function maiorDecimal(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
  return a.greaterThan(b) ? a : b;
}

/**
 * Teto mensal de previsões.
 *
 * Só faz sentido para quem tem o recurso: sem o Premium não existe previsão, e
 * `0` diz isso à tela sem precisar de um campo à parte para "indisponível".
 */
function limitePrevisoesIa(plano: {
  iaHabilitada: boolean;
  limitePrevisoesIaMensais: number | null;
}): number | null {
  return plano.iaHabilitada ? plano.limitePrevisoesIaMensais : 0;
}
