'use server';

import { revalidatePath } from 'next/cache';
import { traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

export async function removerHistorico(id: string): Promise<ResultadoAcao> {
  try {
    await apiComSessao<void>(`/auditoria/${id}`, { method: 'DELETE' });
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível excluir este histórico. Tente novamente.');
  }

  revalidatePath('/painel/historico');
  return {};
}
