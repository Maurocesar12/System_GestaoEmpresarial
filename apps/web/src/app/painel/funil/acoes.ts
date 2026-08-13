'use server';

import { revalidatePath } from 'next/cache';
import type { MoverClienteInput } from '@gestao/shared-types';
import { ApiRequestError } from '@/lib/api';
import { apiComSessao } from '@/lib/api-servidor';

export interface ResultadoAcao {
  erro?: string;
}

/**
 * Move um cliente de etapa.
 *
 * Chamada quando o cartão é solto em outra coluna. A tela já atualizou o
 * visual antes de esta ação terminar (atualização otimista); se der erro, ela
 * desfaz e mostra a mensagem.
 */
export async function moverCliente(dados: MoverClienteInput): Promise<ResultadoAcao> {
  try {
    await apiComSessao<void>('/funil/mover', {
      method: 'POST',
      body: JSON.stringify(dados),
    });
  } catch (erro) {
    return traduzirErro(erro);
  }

  revalidatePath('/painel/funil');
  return {};
}

export async function removerDoFunil(clienteId: string): Promise<ResultadoAcao> {
  try {
    await apiComSessao<void>(`/funil/clientes/${clienteId}`, { method: 'DELETE' });
  } catch (erro) {
    return traduzirErro(erro);
  }

  revalidatePath('/painel/funil');
  return {};
}

function traduzirErro(erro: unknown): ResultadoAcao {
  if (erro instanceof ApiRequestError) {
    return { erro: erro.erro.mensagem };
  }

  return { erro: 'Não foi possível mover o cliente. Tente novamente.' };
}
