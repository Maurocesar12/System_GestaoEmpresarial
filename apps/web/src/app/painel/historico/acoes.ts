'use server';

import { revalidatePath } from 'next/cache';
import { traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

function caminhoHistorico(id: string): string {
  return `/auditoria/${encodeURIComponent(id.trim())}`;
}

export async function removerHistorico(id: string): Promise<ResultadoAcao> {
  try {
    await apiComSessao<void>(caminhoHistorico(id), { method: 'DELETE' });
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível excluir este histórico. Tente novamente.');
  }

  revalidatePath('/painel/historico');
  return {};
}

export async function removerHistoricos(ids: string[]): Promise<ResultadoAcao> {
  const unicos = [...new Set(ids)].filter(Boolean);

  if (unicos.length === 0) {
    return { erro: 'Selecione pelo menos um histórico para excluir.' };
  }

  try {
    await Promise.all(
      unicos.map((id) => apiComSessao<void>(caminhoHistorico(id), { method: 'DELETE' })),
    );
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível excluir os históricos selecionados.');
  }

  revalidatePath('/painel/historico');
  return {};
}
