import { formatarBRL, type AnalisePrevisaoFinanceira } from '@gestao/shared-types';
import { AssistenteIa, type ContextoPrevisao, type ResultadoAssistenteIa } from './assistente-ia';

/** Análise gerencial baseada em regras, sem chamadas a provedores externos. */
export class AssistenteDemonstracao extends AssistenteIa {
  analisarPrevisao(contexto: ContextoPrevisao): Promise<ResultadoAssistenteIa> {
    const negativos = contexto.projecoes.filter((item) => Number(item.saldoAcumulado) < 0);
    const saldos = contexto.projecoes.map((item) => Number(item.saldoAcumulado));
    const menorSaldo = saldos.length > 0 ? Math.min(...saldos) : Number(contexto.saldoAtual);
    const deficitarios = contexto.projecoes.filter((item) => Number(item.saldo) < 0);
    const ultimo = contexto.projecoes.at(-1);
    const mediaSaidas = contexto.projecoes.length
      ? contexto.projecoes.reduce((total, item) => total + Number(item.saidas), 0) / contexto.projecoes.length
      : 0;
    const nivelRisco: AnalisePrevisaoFinanceira['nivelRisco'] =
      negativos.length > 0
        ? 'alto'
        : deficitarios.length > 0 || menorSaldo <= 0 || menorSaldo < mediaSaidas || menorSaldo < Number(contexto.saldoAtual) * 0.2
          ? 'moderado'
          : 'baixo';
    const primeiro = contexto.projecoes[0];

    return Promise.resolve({
      modo: 'demonstracao',
      modelo: 'analise-local-v2',
      inputTokens: 0,
      outputTokens: 0,
      analise: {
        resumo: negativos.length
          ? `A projeção indica saldo negativo em ${negativos.length} mês(es). O primeiro ponto crítico é ${negativos[0]?.mes}.`
          : ultimo
            ? `O saldo acumulado projetado para ${ultimo.mes} é ${formatarBRL(ultimo.saldoAcumulado)}. ${deficitarios.length ? `Há ${deficitarios.length} mês(es) com saídas maiores que entradas, consumindo o caixa disponível.` : 'Não há meses com saldo mensal negativo na projeção.'}`
            : 'Ainda não há projeções para avaliar o caixa.',
        nivelRisco,
        pontosAtencao: [
          primeiro
            ? `Em ${primeiro.mes}, há ${formatarBRL(primeiro.contasAPagarConhecidas)} a pagar e ${formatarBRL(primeiro.contasAReceberConhecidas)} a receber já registrados. Recebimentos previstos ainda precisam ser confirmados.`
            : 'Ainda não há meses suficientes para detalhar a projeção.',
          'Valores sem baixa e lançamentos futuros incompletos reduzem a precisão.',
          ...(ultimo ? [`O menor saldo acumulado do período é ${formatarBRL(String(menorSaldo))}. Os totais mensais não mostram eventuais faltas de caixa entre vencimentos.`] : []),
          ...(contexto.historico.length < 3 ? ['Histórico curto: há menos de três meses disponíveis para comparação.'] : []),
          ...(mediaSaidas > 0 && menorSaldo >= 0 && menorSaldo < mediaSaidas ? ['O menor saldo projetado é inferior a um mês de saídas médias projetadas; há pouca margem para atrasos de clientes.'] : []),
        ],
        acoesRecomendadas: [
          ...(negativos.length ? [
            `Antes de ${negativos[0]?.mes}, revise os vencimentos no Financeiro e negocie prazos para cobrir o déficit projetado de ${formatarBRL(String(Math.abs(menorSaldo)))}.`,
          ] : []),
          ...(deficitarios.length ? ['Revise as categorias de despesa dos meses deficitários e identifique gastos recorrentes que podem ser ajustados.'] : []),
          'No Financeiro, confira as baixas e os vencimentos de contas a pagar e receber antes de assumir novas despesas.',
          'Nos Orçamentos e no CRM, acompanhe propostas abertas com lembretes de retorno. Proposta aprovada não é dinheiro recebido.',
          'Em Reservas, planeje uma margem para imprevistos considerando despesas essenciais e a regularidade dos recebimentos.',
          'Registre o pró-labore separadamente e inclua as retiradas previstas no planejamento do caixa.',
          'Compare a previsão com os valores realizados a cada fechamento mensal.',
        ],
        avisos: [
          'Análise local por regras sobre os registros da empresa; não utiliza ChatGPT nem consulta bancos automaticamente.',
          'Esta é uma estimativa gerencial, não uma garantia de resultado nem aconselhamento contábil.',
        ],
      },
    });
  }
}
