'use server';

import { revalidatePath } from 'next/cache';
import type { ChaveMarketing } from '@gestao/shared-types';
import { traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

/**
 * Gera — ou troca — a chave do formulário do site.
 *
 * Gerar de novo invalida a anterior na hora. É de propósito: é assim que o
 * assinante revoga uma chave que começou a receber lead falso, sem precisar de
 * uma segunda tela para isso.
 */
export async function gerarChaveMarketing(): Promise<ResultadoAcao> {
  try {
    await apiComSessao<ChaveMarketing>('/marketing/chave', { method: 'POST' });
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível gerar a chave. Tente novamente.');
  }

  revalidatePath('/painel/marketing');

  return {};
}
