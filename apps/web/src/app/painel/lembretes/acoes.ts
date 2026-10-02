'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { LembreteFollowUp, LembreteFormInput } from '@gestao/shared-types';
import { traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

export async function salvarLembrete(dados: LembreteFormInput): Promise<ResultadoAcao> {
  try {
    await apiComSessao<LembreteFollowUp>('/lembretes', {
      method: 'POST',
      body: JSON.stringify(dados),
    });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  revalidatePath('/painel/lembretes');
  redirect('/painel/lembretes');
}

export async function cancelarLembrete(id: string): Promise<ResultadoAcao> {
  try {
    await apiComSessao<LembreteFollowUp>(`/lembretes/${id}/cancelar`, { method: 'POST' });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  revalidatePath('/painel/lembretes');
  return {};
}
