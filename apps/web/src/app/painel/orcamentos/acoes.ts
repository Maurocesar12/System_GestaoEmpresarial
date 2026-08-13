'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  orcamentoFormSchema,
  type AcaoOrcamento,
  type Orcamento,
  type OrcamentoFormInput,
} from '@gestao/shared-types';
import { ApiRequestError } from '@/lib/api';
import { apiComSessao } from '@/lib/api-servidor';

export interface ResultadoAcao {
  erro?: string;
  campos?: Record<string, string[]>;
}

export async function salvarOrcamento(
  id: string | null,
  dados: OrcamentoFormInput,
): Promise<ResultadoAcao> {
  const validacao = orcamentoFormSchema.safeParse(dados);

  if (!validacao.success) {
    return { erro: 'Confira os dados informados.', campos: agruparErros(validacao.error.issues) };
  }

  try {
    await apiComSessao<Orcamento>(id ? `/orcamentos/${id}` : '/orcamentos', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(validacao.data),
    });
  } catch (erro) {
    return traduzirErro(erro);
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
    return traduzirErro(erro);
  }

  revalidatePath('/painel/orcamentos');
  return {};
}

export async function removerOrcamento(id: string): Promise<ResultadoAcao> {
  try {
    await apiComSessao<void>(`/orcamentos/${id}`, { method: 'DELETE' });
  } catch (erro) {
    return traduzirErro(erro);
  }

  revalidatePath('/painel/orcamentos');
  return {};
}

function traduzirErro(erro: unknown): ResultadoAcao {
  if (erro instanceof ApiRequestError) {
    return { erro: erro.erro.mensagem, campos: erro.erro.detalhes };
  }

  return { erro: 'Não foi possível completar a ação. Tente novamente.' };
}

function agruparErros(issues: { path: PropertyKey[]; message: string }[]) {
  const campos: Record<string, string[]> = {};

  for (const issue of issues) {
    const campo = issue.path.join('.') || '_';
    (campos[campo] ??= []).push(issue.message);
  }

  return campos;
}
