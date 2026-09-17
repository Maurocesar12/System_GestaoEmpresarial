'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  ajusteEstoqueSchema,
  entradaEstoqueSchema,
  materialFormSchema,
  type Material,
} from '@gestao/shared-types';
import { erroDeValidacao, traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

export async function salvarMaterial(
  id: string | null,
  dados: { nome: string; unidade: string; estoqueMinimo: string; ativo: boolean },
): Promise<ResultadoAcao> {
  const validacao = materialFormSchema.safeParse(dados);
  if (!validacao.success) return erroDeValidacao(validacao.error.issues);

  let material: Material;

  try {
    material = await apiComSessao<Material>(id ? `/estoque/materiais/${id}` : '/estoque/materiais', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(validacao.data),
    });
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
  const validacao = entradaEstoqueSchema.safeParse(dados);
  if (!validacao.success) return erroDeValidacao(validacao.error.issues);

  try {
    await apiComSessao<Material>(`/estoque/materiais/${id}/entradas`, {
      method: 'POST',
      body: JSON.stringify(validacao.data),
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
  const validacao = ajusteEstoqueSchema.safeParse(dados);
  if (!validacao.success) return erroDeValidacao(validacao.error.issues);

  try {
    await apiComSessao<Material>(`/estoque/materiais/${id}/ajustes`, {
      method: 'POST',
      body: JSON.stringify(validacao.data),
    });
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível ajustar o estoque.');
  }

  revalidatePath('/painel/estoque', 'layout');
  return {};
}
