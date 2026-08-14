import { Body, Query } from '@nestjs/common';
import type { ZodType } from 'zod';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

/**
 * Valida o corpo da requisição contra um schema de `@gestao/shared-types`.
 *
 * Açúcar sobre `@Body(new ZodValidationPipe(schema))`, que aparecia repetido em
 * todas as rotas de escrita da API. Além de encurtar a assinatura, deixa a
 * construção do pipe num lugar só: se um dia ele ganhar uma opção, a mudança
 * não precisa passar por cada controller.
 *
 * @example
 * ```ts
 * @Post()
 * criar(@CorpoValidado(clienteFormSchema) dados: ClienteFormInput) {}
 * ```
 */
export const CorpoValidado = <T>(schema: ZodType<T, unknown>) =>
  Body(new ZodValidationPipe(schema));

/** O mesmo que {@link CorpoValidado}, para a query string. */
export const QueryValidada = <T>(schema: ZodType<T, unknown>) =>
  Query(new ZodValidationPipe(schema));
