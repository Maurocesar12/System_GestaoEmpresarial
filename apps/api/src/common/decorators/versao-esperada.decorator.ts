import { BadRequestException, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { CODIGOS_ERRO } from '@gestao/shared-types';
import type { Request } from 'express';

/**
 * Lê o valor do `If-Match`: `3`, `"3"` ou `W/"3"`. `undefined` quando ausente;
 * 400 quando presente e não for um número de versão.
 */
export function lerVersaoEsperada(bruto: string | undefined): number | undefined {
  if (bruto === undefined) {
    return undefined;
  }

  // Aspas balanceadas ou nenhuma: `"3` é cabeçalho malformado.
  const encontrado = /^\s*(?:W\/)?(?:"(\d{1,9})"|(\d{1,9}))\s*$/.exec(bruto);

  if (!encontrado) {
    throw new BadRequestException({
      codigo: CODIGOS_ERRO.VALIDACAO,
      mensagem: 'Cabeçalho If-Match inválido: envie o número da versão do registro.',
    });
  }

  return Number(encontrado[1] ?? encontrado[2]);
}

/**
 * A versão do registro que a tela tinha aberta, do cabeçalho `If-Match`.
 *
 * Controle otimista de concorrência: a edição só vale se o registro ainda está
 * na versão que a pessoa viu. Ausente (cliente antigo, script), devolve
 * `undefined` e o serviço não confere nada — o comportamento de sempre.
 *
 * Aceita `3`, `"3"` e `W/"3"`, que são as formas de um ETag.
 */
export const VersaoEsperada = createParamDecorator(
  (_dados: unknown, contexto: ExecutionContext): number | undefined =>
    lerVersaoEsperada(contexto.switchToHttp().getRequest<Request>().header('if-match')),
);
