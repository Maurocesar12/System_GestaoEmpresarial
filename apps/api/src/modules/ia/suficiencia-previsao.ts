/**
 * O mínimo de histórico para uma previsão merecer confiança.
 *
 * Abaixo disto a projeção é a média de quase nada, e a análise escreveria com
 * segurança sobre um número que não sustenta decisão nenhuma. Uma empresa com
 * dois lançamentos num mês receberia "risco baixo, caixa crescendo" com a
 * mesma convicção de quem tem um ano de histórico. Melhor recusar e dizer o
 * que falta do que entregar um resultado com cara de certeza.
 *
 * Os dois critérios cobrem falhas diferentes: meses com movimento evita
 * projetar a partir de um único mês bom; lançamentos pagos evita projetar a
 * partir de três meses com um lançamento cada.
 */
export const MINIMO_MESES_COM_MOVIMENTO = 3;
export const MINIMO_LANCAMENTOS_PAGOS = 10;

export interface DadosDeSuficiencia {
  /** Os meses da janela analisada, com os totais já somados. */
  historico: ReadonlyArray<{ entradas: string; saidas: string }>;
  /** Lançamentos da empresa com baixa dentro da mesma janela. */
  lancamentosPagos: number;
}

/**
 * `null` quando há dados para prever; senão, a frase que explica o que falta.
 *
 * Devolve texto, e não um booleano, porque a recusa só ajuda se disser como
 * sair dela. "Dados insuficientes" deixaria a pessoa sem saber se faltam meses,
 * lançamentos ou as duas coisas.
 */
export function motivoParaNaoPrever({
  historico,
  lancamentosPagos,
}: DadosDeSuficiencia): string | null {
  const mesesComMovimento = historico.filter(
    (mes) => Number(mes.entradas) > 0 || Number(mes.saidas) > 0,
  ).length;

  if (
    mesesComMovimento >= MINIMO_MESES_COM_MOVIMENTO &&
    lancamentosPagos >= MINIMO_LANCAMENTOS_PAGOS
  ) {
    return null;
  }

  const meses = mesesComMovimento === 1 ? 'mês' : 'meses';
  const lancamentos = lancamentosPagos === 1 ? 'lançamento pago' : 'lançamentos pagos';

  return (
    `Para a previsão ser confiável, o sistema precisa de pelo menos ${MINIMO_MESES_COM_MOVIMENTO} meses ` +
    `com movimento e ${MINIMO_LANCAMENTOS_PAGOS} lançamentos pagos nos últimos ${historico.length} meses. ` +
    `Hoje há ${mesesComMovimento} ${meses} com movimento e ${lancamentosPagos} ${lancamentos}. ` +
    'Registre as entradas e saídas e dê baixa no que já foi pago. Esta tentativa não contou na sua cota.'
  );
}
