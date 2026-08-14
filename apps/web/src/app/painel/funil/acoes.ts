'use server';

import { revalidatePath } from 'next/cache';
import type { MoverClienteInput } from '@gestao/shared-types';
import { traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

export type { ResultadoAcao } from '@/lib/acoes';

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
    return traduzirErroAcao(erro, 'Não foi possível mover o cliente. Tente novamente.');
  }

  revalidatePath('/painel/funil');
  return {};
}

export async function removerDoFunil(clienteId: string): Promise<ResultadoAcao> {
  try {
    await apiComSessao<void>(`/funil/clientes/${clienteId}`, { method: 'DELETE' });
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível mover o cliente. Tente novamente.');
  }

  revalidatePath('/painel/funil');
  return {};
}
