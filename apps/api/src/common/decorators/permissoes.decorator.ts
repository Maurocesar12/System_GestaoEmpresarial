import { SetMetadata } from '@nestjs/common';
import type { Permissao } from '@gestao/shared-types';

export const CHAVE_PERMISSOES = 'permissoes_necessarias';

/** Exige todas as ações informadas para executar a rota. */
export const Permissoes = (...permissoes: Permissao[]) =>
  SetMetadata(CHAVE_PERMISSOES, permissoes);
