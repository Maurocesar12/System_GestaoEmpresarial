'use server';

import { redirect } from 'next/navigation';
import { aceitarConviteSchema, type AceitarConviteInput, type SessaoResponse } from '@gestao/shared-types';
import { erroDeValidacao, traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiFetch } from '@/lib/api';
import { gravarSessao } from '@/lib/sessao';

export async function aceitarConvite(dados: AceitarConviteInput): Promise<ResultadoAcao> {
  const validacao = aceitarConviteSchema.safeParse(dados);
  if (!validacao.success) return erroDeValidacao(validacao.error.issues);
  try {
    const sessao = await apiFetch<SessaoResponse>('/equipe/convites/aceitar', {
      method: 'POST', body: JSON.stringify(validacao.data),
    });
    await gravarSessao(sessao);
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível aceitar o convite.');
  }
  redirect('/painel');
}
