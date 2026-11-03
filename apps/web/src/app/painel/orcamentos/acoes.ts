'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { AcaoOrcamento, Orcamento, OrcamentoFormEntrada } from '@gestao/shared-types';
import { traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { cabecalhoIdempotencia, cabecalhoVersao } from '@/lib/api';
import { apiComSessao } from '@/lib/api-servidor';

/** `chave` (Idempotency-Key) protege a criação contra duplo clique e reenvio. */
export async function salvarOrcamento(
  id: string | null,
  dados: OrcamentoFormEntrada,
  chave?: string,
  /** Só na edição: a versão que a tela abriu. Se mudou (inclusive por uma resposta), 409. */
  versao?: number,
): Promise<ResultadoAcao> {
  try {
    await apiComSessao<Orcamento>(id ? `/orcamentos/${id}` : '/orcamentos', {
      method: id ? 'PATCH' : 'POST',
      headers: id ? cabecalhoVersao(versao) : cabecalhoIdempotencia(chave),
      body: JSON.stringify(dados),
    });
  } catch (erro) {
    return traduzirErroAcao(erro);
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
    return traduzirErroAcao(erro);
  }

  revalidatePath('/painel/orcamentos');
  return {};
}
