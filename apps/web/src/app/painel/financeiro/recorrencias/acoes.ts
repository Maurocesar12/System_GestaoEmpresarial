'use server';

import { revalidatePath } from 'next/cache';
import {
  recorrenciaFormSchema,
  type LancamentoRecorrente,
  type RecorrenciaFormEntrada,
} from '@gestao/shared-types';
import { erroDeValidacao, traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

export async function criarRecorrencia(dados: RecorrenciaFormEntrada): Promise<ResultadoAcao> {
  const validacao = recorrenciaFormSchema.safeParse(dados);

  if (!validacao.success) {
    return erroDeValidacao(validacao.error.issues);
  }

  try {
    await apiComSessao<LancamentoRecorrente>('/financeiro/recorrencias', {
      method: 'POST',
      body: JSON.stringify(validacao.data),
    });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  revalidatePath('/painel/financeiro', 'layout');
  return {};
}

/**
 * Pausa ou retoma a geração.
 *
 * Manda o estado desejado, e não a transição: dois cliques rápidos no
 * interruptor não podem alternar duas vezes e terminar no estado errado.
 */
export async function alternarRecorrencia(id: string, ativo: boolean): Promise<ResultadoAcao> {
  try {
    await apiComSessao<LancamentoRecorrente>(`/financeiro/recorrencias/${id}/ativo`, {
      method: 'PATCH',
      body: JSON.stringify({ ativo }),
    });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  revalidatePath('/painel/financeiro', 'layout');
  return {};
}

export async function removerRecorrencia(id: string): Promise<ResultadoAcao> {
  try {
    await apiComSessao<void>(`/financeiro/recorrencias/${id}`, { method: 'DELETE' });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  revalidatePath('/painel/financeiro', 'layout');
  return {};
}
