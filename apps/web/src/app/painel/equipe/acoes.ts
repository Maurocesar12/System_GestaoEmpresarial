'use server';

import { revalidatePath } from 'next/cache';
import type { AtualizarFuncionarioEntrada, ConviteEquipeInput } from '@gestao/shared-types';
import { traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
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

export async function atualizarFuncionario(
  id: string,
  dados: AtualizarFuncionarioEntrada,
): Promise<ResultadoAcao> {
  try {
    await apiComSessao(`/equipe/funcionarios/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dados),
    });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }
  revalidatePath('/painel/equipe');
  return {};
}

/** Para quem perdeu o celular e os códigos de recuperação. A API só aceita do admin. */
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
