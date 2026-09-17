import type { Prisma } from '../../../generated/prisma/client';

/**
 * Valor da comissão, ou `null` quando não há comissão a gerar.
 *
 * Percentual ausente ou zero significa que a pessoa não recebe aquele tipo.
 * Base zero também não gera: uma comissão de R$ 0,00 só poluiria o fechamento.
 */
export function calcularComissao(
  base: Prisma.Decimal | null,
  percentual: Prisma.Decimal | null,
): Prisma.Decimal | null {
  if (!base || !percentual || percentual.lte(0) || base.lte(0)) {
    return null;
  }

  return base.times(percentual).dividedBy(100).toDecimalPlaces(2);
}
