import { type BaseDaPrevisao, type GerarPrevisaoFinanceiraInput } from '@gestao/shared-types';
import { type TransacaoComTenant } from '../../infra/prisma/prisma.service';
import { ZERO } from '../financeiro/decimal';
import { moeda } from './calculos-previsao';

/**
 * O retrato do negócio que a IA recebe: números já calculados, nunca a lista
 * de lançamentos. Função pura — não consulta nada, só organiza o que veio.
 */

/**
 * O negócio além do extrato.
 *
 * Tudo em agregados — contagens, somas e médias. Nenhum nome de cliente e
 * nenhuma descrição saem daqui, porque este objeto é justamente o que segue
 * para o fornecedor de IA.
 */
export async function retratoDoNegocio(
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
