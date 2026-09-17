import { Prisma } from '../../../generated/prisma/client';

type Decimal = Prisma.Decimal;

/**
 * Custo médio ponderado depois de uma compra.
 *
 * Com saldo zerado ou negativo não há custo anterior a ponderar — o saldo
 * negativo é consumo que não passou por entrada, e misturá-lo puxaria o custo
 * novo para um número sem sentido. A compra define o custo.
 */
export function custoMedioAposEntrada(
  quantidadeAtual: Decimal,
  custoAtual: Decimal,
  quantidadeEntrada: Decimal,
  custoEntrada: Decimal,
): Decimal {
  if (quantidadeAtual.lte(0)) {
    return custoEntrada.toDecimalPlaces(4);
  }

  return quantidadeAtual
    .times(custoAtual)
    .plus(quantidadeEntrada.times(custoEntrada))
    .dividedBy(quantidadeAtual.plus(quantidadeEntrada))
    .toDecimalPlaces(4);
}

/** Valor em dinheiro de uma movimentação. */
export function valorMovimentacao(quantidade: Decimal, custoUnitario: Decimal): Decimal {
  return quantidade.times(custoUnitario).toDecimalPlaces(2);
}

/** Quantidade para a resposta, sem zeros sobrando: "12.500" vira "12.5". */
export function paraQuantidade(valor: Decimal): string {
  return valor
    .toFixed(3)
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '');
}
