'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  categoriaFormSchema,
  lancamentoFormSchema,
  type CategoriaFinanceira,
  type CategoriaFormInput,
  type Lancamento,
  type LancamentoFormInput,
} from '@gestao/shared-types';
import { ApiRequestError } from '@/lib/api';
import { apiComSessao } from '@/lib/api-servidor';

export interface ResultadoAcao {
  erro?: string;
  campos?: Record<string, string[]>;
}

export async function salvarLancamento(
  id: string | null,
  dados: LancamentoFormInput,
): Promise<ResultadoAcao> {
  const validacao = lancamentoFormSchema.safeParse(dados);

  if (!validacao.success) {
    return { erro: 'Confira os dados informados.', campos: agruparErros(validacao.error.issues) };
  }

  try {
    await apiComSessao<Lancamento>(
      id ? `/financeiro/lancamentos/${id}` : '/financeiro/lancamentos',
      { method: id ? 'PATCH' : 'POST', body: JSON.stringify(validacao.data) },
    );
  } catch (erro) {
    return traduzirErro(erro);
  }

  // Todo relatório do financeiro deriva dos lançamentos: um valor novo muda o
  // fluxo de caixa e a margem ao mesmo tempo.
  revalidatePath('/painel/financeiro', 'layout');
  redirect('/painel/financeiro');
}

export async function removerLancamento(id: string): Promise<ResultadoAcao> {
  try {
    await apiComSessao<void>(`/financeiro/lancamentos/${id}`, { method: 'DELETE' });
  } catch (erro) {
    return traduzirErro(erro);
  }

  revalidatePath('/painel/financeiro', 'layout');
  return {};
}

export async function criarCategoria(dados: CategoriaFormInput): Promise<ResultadoAcao> {
  const validacao = categoriaFormSchema.safeParse(dados);

  if (!validacao.success) {
    return { erro: validacao.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  try {
    await apiComSessao<CategoriaFinanceira>('/financeiro/categorias', {
      method: 'POST',
      body: JSON.stringify(validacao.data),
    });
  } catch (erro) {
    return traduzirErro(erro);
  }

  revalidatePath('/painel/financeiro', 'layout');
  return {};
}

export async function removerCategoria(id: string): Promise<ResultadoAcao> {
  try {
    await apiComSessao<void>(`/financeiro/categorias/${id}`, { method: 'DELETE' });
  } catch (erro) {
    // A API recusa categoria em uso e diz quantos lançamentos dependem dela.
    return traduzirErro(erro);
  }

  revalidatePath('/painel/financeiro', 'layout');
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
