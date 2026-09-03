'use server';

import { revalidatePath } from 'next/cache';
import {
  atualizarFuncionarioSchema,
  conviteEquipeSchema,
  type AtualizarFuncionarioInput,
  type ConviteEquipeInput,
} from '@gestao/shared-types';
import { erroDeValidacao, traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

export async function convidarFuncionario(dados: ConviteEquipeInput): Promise<ResultadoAcao> {
  const validacao = conviteEquipeSchema.safeParse(dados);
  if (!validacao.success) return erroDeValidacao(validacao.error.issues);
  try {
    await apiComSessao('/equipe/convites', {
      method: 'POST',
      body: JSON.stringify(validacao.data),
    });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }
  revalidatePath('/painel/equipe');
  return {};
}

export async function atualizarFuncionario(
  id: string,
  dados: AtualizarFuncionarioInput,
): Promise<ResultadoAcao> {
  const validacao = atualizarFuncionarioSchema.safeParse(dados);
  if (!validacao.success) return erroDeValidacao(validacao.error.issues);
  try {
    await apiComSessao(`/equipe/funcionarios/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(validacao.data),
    });
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
