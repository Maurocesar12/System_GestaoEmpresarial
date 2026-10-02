'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type {
  CategoriaFinanceira,
  CategoriaFormInput,
  Lancamento,
  LancamentoFormEntrada,
  SimulacaoParcelas,
} from '@gestao/shared-types';
import { traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

export async function salvarLancamento(
  id: string | null,
  dados: LancamentoFormEntrada,
): Promise<ResultadoAcao> {
  try {
    await apiComSessao<Lancamento>(
      id ? `/financeiro/lancamentos/${id}` : '/financeiro/lancamentos',
      { method: id ? 'PATCH' : 'POST', body: JSON.stringify(dados) },
    );
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  // Todo relatório do financeiro deriva dos lançamentos: um valor novo muda o
  // fluxo de caixa e a margem ao mesmo tempo.
  revalidatePath('/painel/financeiro', 'layout');
  redirect('/painel/financeiro');
}

/** Prévia do parcelamento, calculada pela API. Erro só some com a prévia. */
export async function simularParcelas(dados: {
  valor: string;
  parcelas: string;
}): Promise<{ dados?: SimulacaoParcelas }> {
  try {
    return {
      dados: await apiComSessao<SimulacaoParcelas>('/financeiro/lancamentos/simular-parcelas', {
        method: 'POST',
        body: JSON.stringify(dados),
      }),
    };
  } catch {
    return {};
  }
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
  try {
    await apiComSessao<CategoriaFinanceira>('/financeiro/categorias', {
      method: 'POST',
      body: JSON.stringify(dados),
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
