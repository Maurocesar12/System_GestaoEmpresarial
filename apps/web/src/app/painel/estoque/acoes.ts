'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Material, SimulacaoCustoMateriais } from '@gestao/shared-types';
import { traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

export async function salvarMaterial(
  id: string | null,
  dados: { nome: string; unidade: string; estoqueMinimo: string; ativo: boolean },
): Promise<ResultadoAcao> {
  let material: Material;

  try {
    material = await apiComSessao<Material>(
      id ? `/estoque/materiais/${id}` : '/estoque/materiais',
      {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(dados),
      },
    );
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível salvar o material.');
  }

  revalidatePath('/painel/estoque', 'layout');

  if (id) return {};
  redirect(`/painel/estoque/${material.id}`);
}

export async function registrarEntrada(
  id: string,
  dados: { quantidade: string; custoUnitario: string; data: string; observacao: string },
): Promise<ResultadoAcao> {
  try {
    await apiComSessao<Material>(`/estoque/materiais/${id}/entradas`, {
      method: 'POST',
      body: JSON.stringify(dados),
    });
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível registrar a entrada.');
  }

  revalidatePath('/painel/estoque', 'layout');
  return {};
}

export async function registrarAjuste(
  id: string,
  dados: { quantidadeContada: string; observacao: string },
): Promise<ResultadoAcao> {
  try {
    await apiComSessao<Material>(`/estoque/materiais/${id}/ajustes`, {
      method: 'POST',
      body: JSON.stringify(dados),
    });
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível ajustar o estoque.');
  }

  revalidatePath('/painel/estoque', 'layout');
  return {};
}

/** Prévia do custo de uma lista de materiais, calculada pela API. Erro só some com a prévia. */
export async function simularCustoMateriais(dados: {
  itens: Array<{ materialId: string; quantidade: string }>;
}): Promise<{ dados?: SimulacaoCustoMateriais }> {
  try {
    return {
      dados: await apiComSessao<SimulacaoCustoMateriais>('/estoque/simular-custo', {
        method: 'POST',
        body: JSON.stringify(dados),
      }),
    };
  } catch {
    return {};
  }
}
