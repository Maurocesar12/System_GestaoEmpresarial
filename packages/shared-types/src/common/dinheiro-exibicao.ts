import type { Dinheiro } from './dinheiro';

/** Valores de exibição de `dinheiro`, sem Zod: o que a tela importa não carrega os schemas. */

/**
 * Construído uma vez, no módulo.
 *
 * Montar um `Intl.NumberFormat` custa resolução de locale — ordens de grandeza
 * mais caro que formatar um número com ele pronto. Como `formatarBRL` é chamada
 * dentro de `.map()` de tabelas e cartões, criar um formatador por valor
 * significaria dezenas de construções por tela.
 */
export const FORMATADOR_BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/** Formata um valor monetário para exibição em pt-BR (R$ 1.234,56). */
export function formatarBRL(valor: Dinheiro): string {
  return FORMATADOR_BRL.format(Number(valor));
}
