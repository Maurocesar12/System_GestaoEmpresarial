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
import { erroDeValidacao, primeiroErro, traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

export async function salvarLancamento(
  id: string | null,
  dados: LancamentoFormInput,
): Promise<ResultadoAcao> {
  const validacao = lancamentoFormSchema.safeParse(dados);

  if (!validacao.success) {
    return erroDeValidacao(validacao.error.issues);
  }

  try {
    await apiComSessao<Lancamento>(
      id ? `/financeiro/lancamentos/${id}` : '/financeiro/lancamentos',
      { method: id ? 'PATCH' : 'POST', body: JSON.stringify(validacao.data) },
    );
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  // Todo relatório do financeiro deriva dos lançamentos: um valor novo muda o
  // fluxo de caixa e a margem ao mesmo tempo.
  revalidatePath('/painel/financeiro', 'layout');
  redirect('/painel/financeiro');
}

/**
 * Registra que o dinheiro entrou ou saiu.
 *
 * Sem data, a API usa hoje — que é o caso comum de quem está conferindo o
 * extrato e marcando o que caiu.
 */
export async function darBaixa(id: string, pagoEm?: string): Promise<ResultadoAcao> {
  try {
    await apiComSessao<Lancamento>(`/financeiro/lancamentos/${id}/baixa`, {
      method: 'POST',
      body: JSON.stringify({ pagoEm: pagoEm ?? null }),
    });
  } catch (erro) {
    // A API recusa baixa repetida com 409 e explica o motivo.
    return traduzirErroAcao(erro);
  }

  revalidatePath('/painel/financeiro', 'layout');
  return {};
}

/** Desfaz a baixa, devolvendo o lançamento para em aberto. */
export async function estornarBaixa(id: string): Promise<ResultadoAcao> {
  try {
    await apiComSessao<Lancamento>(`/financeiro/lancamentos/${id}/estornar-baixa`, {
      method: 'POST',
    });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  revalidatePath('/painel/financeiro', 'layout');
  return {};
}

export async function removerLancamento(id: string): Promise<ResultadoAcao> {
  try {
    await apiComSessao<void>(`/financeiro/lancamentos/${id}`, { method: 'DELETE' });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  revalidatePath('/painel/financeiro', 'layout');
  return {};
}

export async function criarCategoria(dados: CategoriaFormInput): Promise<ResultadoAcao> {
  const validacao = categoriaFormSchema.safeParse(dados);

  if (!validacao.success) {
    return primeiroErro(validacao.error.issues);
  }

  try {
    await apiComSessao<CategoriaFinanceira>('/financeiro/categorias', {
      method: 'POST',
      body: JSON.stringify(validacao.data),
    });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  revalidatePath('/painel/financeiro', 'layout');
  return {};
}

export async function removerCategoria(id: string): Promise<ResultadoAcao> {
  try {
    await apiComSessao<void>(`/financeiro/categorias/${id}`, { method: 'DELETE' });
  } catch (erro) {
    // A API recusa categoria em uso e diz quantos lançamentos dependem dela.
    return traduzirErroAcao(erro);
  }

  revalidatePath('/painel/financeiro', 'layout');
  return {};
}
