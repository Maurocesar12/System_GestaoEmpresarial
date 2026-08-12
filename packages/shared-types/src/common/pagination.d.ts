import { z } from 'zod';
/** Query string de paginação aceita por toda listagem da API. */
export declare const paginacaoQuerySchema: z.ZodObject<
  {
    pagina: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    porPagina: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
  },
  z.core.$strip
>;
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
//# sourceMappingURL=pagination.d.ts.map
