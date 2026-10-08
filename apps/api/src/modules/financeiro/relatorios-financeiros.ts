import {
  type FluxoDeCaixa,
  type MargemPorServico,
  type PeriodoQuery,
  type RelatorioMargem,
  type ResumoContas,
} from '@gestao/shared-types';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ZERO } from './decimal';
import { hojeEmDia } from './datas';
import { filtroDePeriodo } from './lancamento-banco';

/**
 * Os números do financeiro: contas em aberto, fluxo de caixa e margem.
 *
 * **Toda soma acontece no banco**, com `groupBy` e `aggregate` sobre colunas
 * `NUMERIC` — somar em JavaScript faria a conta em ponto flutuante.
 */

/**
 * Quanto há em aberto, e quanto disso já venceu.
 *
 * São quatro somas agregadas no banco, e não uma varredura de lançamentos:
 * a tela precisa de oito números, não da lista inteira.
 */
export async function resumoContas(prisma: PrismaService): Promise<ResumoContas> {
  const hoje = new Date(`${hojeEmDia()}T00:00:00Z`);
  const emAberto: Prisma.LancamentoFinanceiroWhereInput = {
    pagoEm: null,
    natureza: 'empresa',
  };
  const vencido = { ...emAberto, vencimento: { lt: hoje } };

  const [receber, pagar, receberVencido, pagarVencido] = await prisma.comTenant((tx) =>
    Promise.all([
      tx.lancamentoFinanceiro.aggregate({
        where: { ...emAberto, tipo: 'entrada' },
        _sum: { valor: true },
        _count: { _all: true },
      }),
      tx.lancamentoFinanceiro.aggregate({
        where: { ...emAberto, tipo: 'saida' },
        _sum: { valor: true },
        _count: { _all: true },
      }),
      tx.lancamentoFinanceiro.aggregate({
        where: { ...vencido, tipo: 'entrada' },
        _sum: { valor: true },
        _count: { _all: true },
      }),
      tx.lancamentoFinanceiro.aggregate({
        where: { ...vencido, tipo: 'saida' },
        _sum: { valor: true },
        _count: { _all: true },
      }),
    ]),
  );

  const totalizar = (grupo: {
    _sum: { valor: Prisma.Decimal | null };
    _count: { _all: number };
  }) => ({
    total: (grupo._sum.valor ?? ZERO).toFixed(2),
    quantidade: grupo._count._all,
  });

  return {
    aReceber: totalizar(receber),
    aPagar: totalizar(pagar),
    vencidoAReceber: totalizar(receberVencido),
    vencidoAPagar: totalizar(pagarVencido),
  };
}

/**
 * Fluxo de caixa do período.
 *
 * Ignora lançamentos pessoais por padrão: misturá-los ao caixa da empresa
 * distorceria o custo operacional e, por consequência, toda decisão de preço.
 */
export async function fluxoDeCaixa(
  prisma: PrismaService,
  query: PeriodoQuery,
): Promise<FluxoDeCaixa> {
  const where = filtroDePeriodo(query);

  // As quatro somas são independentes e vão juntas ao banco. Trazer as saídas
  // linha a linha para somar em JavaScript custaria uma transferência
  // proporcional ao movimento do mês para produzir dois números.
  const [porTipo, fixo, variavel] = await prisma.comTenant((tx) =>
    Promise.all([
      tx.lancamentoFinanceiro.groupBy({ by: ['tipo'], where, _sum: { valor: true } }),
      // Saída sem categoria não entra em nenhum dos dois: classificá-la por
      // suposição inventaria um número.
      tx.lancamentoFinanceiro.aggregate({
        where: { ...where, tipo: 'saida', categoria: { tipoCusto: 'fixo' } },
        _sum: { valor: true },
      }),
      tx.lancamentoFinanceiro.aggregate({
        where: { ...where, tipo: 'saida', categoria: { tipoCusto: 'variavel' } },
        _sum: { valor: true },
      }),
    ]),
  );

  const entradas = porTipo.find((g) => g.tipo === 'entrada')?._sum.valor ?? ZERO;
  const saidas = porTipo.find((g) => g.tipo === 'saida')?._sum.valor ?? ZERO;

  const custoFixo = fixo._sum.valor ?? ZERO;
  const custoVariavel = variavel._sum.valor ?? ZERO;

  return {
    entradas: entradas.toFixed(2),
    saidas: saidas.toFixed(2),
    saldo: entradas.minus(saidas).toFixed(2),
    custoFixo: custoFixo.toFixed(2),
    custoVariavel: custoVariavel.toFixed(2),

    // O que sobra das saídas depois de tirar fixo e variável: as saídas sem
    // categoria. Reportado em vez de ignorado para que os três números fechem
    // com o total — antes eles não fechavam, e a diferença sumia calada.
    //
    // Calculado por subtração, e não com uma quarta consulta, porque
    // `saidas` já é a soma de todas elas.
    custoNaoClassificado: saidas.minus(custoFixo).minus(custoVariavel).toFixed(2),

    periodo: { de: query.de, ate: query.ate },
  };
}

/**
 * Margem por tipo de serviço.
 *
 * Este é o relatório que justifica CRM e financeiro viverem no mesmo banco
 * (§1). Ele responde a pergunta que o dono não consegue responder com
 * planilha: *qual serviço realmente dá lucro?*
 */
export async function margemPorServico(
  prisma: PrismaService,
  query: PeriodoQuery,
): Promise<RelatorioMargem> {
  const where = filtroDePeriodo(query);

  // Material e comissão não têm natureza nem categoria: são sempre da empresa
  // e ficam fora quando o relatório é filtrado por algo que eles não têm.
  const incluiOperacao = (query.natureza ?? 'empresa') === 'empresa' && !query.categoriaId;
  const dias = {
    gte: new Date(`${query.de}T00:00:00Z`),
    lte: new Date(`${query.ate}T00:00:00Z`),
  };

  const [grupos, servicos, consumos, comissoes] = await prisma.comTenant((tx) =>
    Promise.all([
      // Uma passada só: receita e custo de todos os serviços, agrupados pelo
      // banco. A alternativa — uma consulta por serviço — multiplicaria as
      // idas ao banco pelo tamanho do catálogo.
      tx.lancamentoFinanceiro.groupBy({
        by: ['servicoId', 'tipo'],
        where,
        _sum: { valor: true },
        _count: { _all: true },
      }),
      tx.servico.findMany({ select: { id: true, nome: true } }),
      incluiOperacao
        ? tx.movimentacaoEstoque.groupBy({
            by: ['servicoId'],
            where: { tipo: 'consumo', servicoId: { not: null }, data: dias },
            _sum: { valorTotal: true },
          })
        : [],
      incluiOperacao
        ? tx.comissao.groupBy({
            by: ['servicoId'],
            where: { servicoId: { not: null }, competencia: dias },
            _sum: { valor: true },
          })
        : [],
    ]),
  );

  const nomePorServico = new Map(servicos.map((servico) => [servico.id, servico.nome]));
  const acumulado = new Map<
    string,
    {
      receita: Prisma.Decimal;
      custoLancamentos: Prisma.Decimal;
      custoMateriais: Prisma.Decimal;
      custoComissoes: Prisma.Decimal;
      quantidade: number;
    }
  >();
  const linha = (servicoId: string) =>
    acumulado.get(servicoId) ?? {
      receita: ZERO,
      custoLancamentos: ZERO,
      custoMateriais: ZERO,
      custoComissoes: ZERO,
      quantidade: 0,
    };

  let receitaSemServico = ZERO;

  for (const grupo of grupos) {
    const valor = grupo._sum.valor ?? ZERO;

    // Receita sem serviço vinculado fica de fora das margens, mas é reportada
    // à parte — uma lacuna visível é melhor que um número silenciosamente
    // incompleto.
    if (!grupo.servicoId) {
      if (grupo.tipo === 'entrada') {
        receitaSemServico = receitaSemServico.plus(valor);
      }
      continue;
    }

    const atual = linha(grupo.servicoId);

    if (grupo.tipo === 'entrada') {
      atual.receita = atual.receita.plus(valor);
      atual.quantidade += grupo._count._all;
    } else {
      atual.custoLancamentos = atual.custoLancamentos.plus(valor);
    }

    acumulado.set(grupo.servicoId, atual);
  }

  for (const grupo of consumos) {
    if (!grupo.servicoId) continue;
    const atual = linha(grupo.servicoId);
    atual.custoMateriais = atual.custoMateriais.plus(grupo._sum.valorTotal ?? ZERO);
    acumulado.set(grupo.servicoId, atual);
  }

  for (const grupo of comissoes) {
    if (!grupo.servicoId) continue;
    const atual = linha(grupo.servicoId);
    atual.custoComissoes = atual.custoComissoes.plus(grupo._sum.valor ?? ZERO);
    acumulado.set(grupo.servicoId, atual);
  }

  const itens: MargemPorServico[] = [...acumulado.entries()]
    .map(([servicoId, valores]) => {
      const { receita, custoLancamentos, custoMateriais, custoComissoes, quantidade } = valores;
      const custo = custoLancamentos.plus(custoMateriais).plus(custoComissoes);
      const margem = receita.minus(custo);

      return {
        servicoId,
        servicoNome: nomePorServico.get(servicoId) ?? 'Serviço removido',
        receita: receita.toFixed(2),
        custo: custo.toFixed(2),
        custoLancamentos: custoLancamentos.toFixed(2),
        custoMateriais: custoMateriais.toFixed(2),
        custoComissoes: custoComissoes.toFixed(2),
        margem: margem.toFixed(2),
        // Percentual só faz sentido com receita: dividir por zero não é
        // "margem zero", é pergunta sem resposta.
        margemPercentual: receita.isZero()
          ? null
          : Number(margem.dividedBy(receita).times(100).toFixed(1)),
        quantidade,
      };
    })
    // Maior margem primeiro: a pergunta é "o que dá mais lucro?".
    .sort((a, b) => Number(b.margem) - Number(a.margem));

  return {
    itens,
    receitaSemServico: receitaSemServico.toFixed(2),
    periodo: { de: query.de, ate: query.ate },
  };
}
