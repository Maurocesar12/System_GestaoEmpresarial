import { Prisma } from '../../generated/prisma/client';

/** Contas de apoio da previsão financeira: meses, somas e médias em `Decimal`. */

import { ZERO } from '../financeiro/decimal';

export const AVISO_PREVISAO =
  'Estimativa baseada nos lançamentos registrados. Não é garantia de resultado nem aconselhamento contábil.';

export function inicioMes(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), 1));
}

export function somarMeses(data: Date, quantidade: number): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + quantidade, 1));
}

export function chaveMes(data: Date): string {
  return data.toISOString().slice(0, 7);
}

export function moeda(valor: Prisma.Decimal): string {
  return valor.toFixed(2);
}

export function somar(itens: Array<{ valor: Prisma.Decimal }>): Prisma.Decimal {
  return itens.reduce((total, item) => total.plus(item.valor), ZERO);
}

export function mediaPonderada(valores: Prisma.Decimal[]): Prisma.Decimal {
  const pesoTotal = valores.reduce((total, _, indice) => total + indice + 1, 0);
  return pesoTotal === 0
    ? ZERO
    : valores
        .reduce((total, valor, indice) => total.plus(valor.times(indice + 1)), ZERO)
        .dividedBy(pesoTotal);
}

export function maiorDecimal(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
  return a.greaterThan(b) ? a : b;
}

/**
 * Teto mensal de previsões.
 *
 * Só faz sentido para quem tem o recurso: sem o Premium não existe previsão, e
 * `0` diz isso à tela sem precisar de um campo à parte para "indisponível".
 */
export function limitePrevisoesIa(plano: {
  iaHabilitada: boolean;
  limitePrevisoesIaMensais: number | null;
}): number | null {
  return plano.iaHabilitada ? plano.limitePrevisoesIaMensais : 0;
}
