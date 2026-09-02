import { Prisma } from '../../generated/prisma/client';

/**
 * Zero decimal, construído uma vez.
 *
 * Os três serviços do módulo precisam dele para representar "nada somado".
 * `Prisma.Decimal` é imutável — toda operação devolve uma instância nova —,
 * então compartilhar a mesma constante é seguro.
 */
export const ZERO = new Prisma.Decimal(0);
