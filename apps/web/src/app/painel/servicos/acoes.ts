'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  fichaTecnicaSchema,
  servicoFormSchema,
  type FichaTecnica,
  type Servico,
  type ServicoFormInput,
} from '@gestao/shared-types';
import {
  erroDeValidacao,
  primeiroErro,
  traduzirErroAcao,
  type ResultadoAcao,
} from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

export async function salvarServico(
  id: string | null,
  dados: ServicoFormInput,
): Promise<ResultadoAcao> {
  const validacao = servicoFormSchema.safeParse(dados);

  if (!validacao.success) {
    return erroDeValidacao(validacao.error.issues);
  }

  try {
    await apiComSessao<Servico>(id ? `/servicos/${id}` : '/servicos', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(validacao.data),
    });
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível salvar. Tente novamente.');
  }

  revalidatePath('/painel/servicos');
  redirect('/painel/servicos');
}

export async function salvarFichaTecnica(
  servicoId: string,
  itens: Array<{ materialId: string; quantidade: string }>,
): Promise<ResultadoAcao> {
  const validacao = fichaTecnicaSchema.safeParse({ itens });
  if (!validacao.success) return primeiroErro(validacao.error.issues);

  try {
    await apiComSessao<FichaTecnica>(`/servicos/${servicoId}/materiais`, {
      method: 'PUT',
      body: JSON.stringify(validacao.data),
    });
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível salvar a lista de materiais.');
  }

  revalidatePath(`/painel/servicos/${servicoId}`);
  return {};
}

/** Desativa o serviço. Ele some das listas novas, mas o histórico permanece. */
export async function desativarServico(id: string): Promise<ResultadoAcao> {
  try {
    await apiComSessao<Servico>(`/servicos/${id}`, { method: 'DELETE' });
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível salvar. Tente novamente.');
  }

  revalidatePath('/painel/servicos');
  return {};
}
