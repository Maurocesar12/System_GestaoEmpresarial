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
