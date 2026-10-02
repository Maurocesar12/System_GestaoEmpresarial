'use server';

import { redirect } from 'next/navigation';
import type { AceitarConviteInput, SessaoResponse } from '@gestao/shared-types';
import { traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiFetch } from '@/lib/api';
import { gravarSessao } from '@/lib/sessao';

export async function aceitarConvite(dados: AceitarConviteInput): Promise<ResultadoAcao> {
  try {
    const sessao = await apiFetch<SessaoResponse>('/equipe/convites/aceitar', {
      method: 'POST',
      body: JSON.stringify(dados),
    });
    await gravarSessao(sessao);
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível aceitar o convite.');
  }
  redirect('/painel');
}
