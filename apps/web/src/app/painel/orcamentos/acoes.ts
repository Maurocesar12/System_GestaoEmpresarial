'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { AcaoOrcamento, Orcamento, OrcamentoFormEntrada } from '@gestao/shared-types';
import { traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

export async function salvarOrcamento(
  id: string | null,
  dados: OrcamentoFormEntrada,
): Promise<ResultadoAcao> {
  try {
    await apiComSessao<Orcamento>(id ? `/orcamentos/${id}` : '/orcamentos', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(dados),
    });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  revalidatePath('/painel/orcamentos');
  redirect('/painel/orcamentos');
}

/**
 * Aplica uma transição da máquina de estados.
 *
 * A tela só mostra os botões possíveis para o status atual, mas a validação
 * real acontece na API — botão escondido é conveniência, não garantia.
 */
export async function mudarStatus(id: string, acao: AcaoOrcamento): Promise<ResultadoAcao> {
  try {
    await apiComSessao<Orcamento>(`/orcamentos/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ acao }),
    });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  revalidatePath('/painel/orcamentos');
  return {};
}
