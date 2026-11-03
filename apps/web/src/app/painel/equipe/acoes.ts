'use server';

import { revalidatePath } from 'next/cache';
import type { AtualizarFuncionarioEntrada, ConviteEquipeInput } from '@gestao/shared-types';
import { traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { cabecalhoVersao } from '@/lib/api';
import { apiComSessao } from '@/lib/api-servidor';

export async function convidarFuncionario(dados: ConviteEquipeInput): Promise<ResultadoAcao> {
  try {
    await apiComSessao('/equipe/convites', {
      method: 'POST',
      body: JSON.stringify(dados),
    });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }
  revalidatePath('/painel/equipe');
  return {};
}

/** `versao`: a que a tela abriu; se mudou, a API recusa com 409. */
export async function atualizarFuncionario(
  id: string,
  dados: AtualizarFuncionarioEntrada,
  versao?: number,
): Promise<ResultadoAcao> {
  try {
    await apiComSessao(`/equipe/funcionarios/${id}`, {
      method: 'PATCH',
      headers: cabecalhoVersao(versao),
      body: JSON.stringify(dados),
    });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }
  revalidatePath('/painel/equipe');
  return {};
}

/** Para quem perdeu ou trocou de celular. A API só aceita do admin. */
export async function redefinirDoisFatores(id: string): Promise<ResultadoAcao> {
  try {
    await apiComSessao(`/equipe/funcionarios/${id}/redefinir-2fa`, { method: 'POST' });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }
  revalidatePath('/painel/equipe');
  return {};
}

export async function cancelarConvite(id: string): Promise<ResultadoAcao> {
  try {
    await apiComSessao(`/equipe/convites/${id}`, { method: 'DELETE' });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }
  revalidatePath('/painel/equipe');
  return {};
}
