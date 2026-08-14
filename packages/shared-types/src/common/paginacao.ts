import { z } from 'zod';

/** Query string de paginação aceita por toda listagem da API. */
export const paginacaoQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  porPagina: z.coerce.number().int().positive().max(100).default(20),
});

export type PaginacaoQuery = z.infer<typeof paginacaoQuerySchema>;

export interface PaginacaoMeta {
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
}

/** Envelope padrão de toda listagem paginada. */
export interface Paginado<T> {
  dados: T[];
  meta: PaginacaoMeta;
}

/**
 * Monta o envelope de uma listagem paginada.
 *
 * Existe para que o cálculo de `totalPaginas` more num lugar só. O
 * `Math.max(1, ...)` garante que uma listagem vazia informe "página 1 de 1", e
 * não "de 0" — que a tela exibiria como um paginador sem páginas.
 */
export function paginar<T>(dados: T[], total: number, query: PaginacaoQuery): Paginado<T> {
  return {
    dados,
    meta: {
      pagina: query.pagina,
      porPagina: query.porPagina,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / query.porPagina)),
    },
  };
}
