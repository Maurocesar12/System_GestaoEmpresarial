'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { servicoFormSchema, type Servico, type ServicoFormInput } from '@gestao/shared-types';
import { ApiRequestError } from '@/lib/api';
import { apiComSessao } from '@/lib/api-servidor';

export interface ResultadoAcao {
  erro?: string;
  campos?: Record<string, string[]>;
}

export async function salvarServico(
  id: string | null,
  dados: ServicoFormInput,
): Promise<ResultadoAcao> {
  const validacao = servicoFormSchema.safeParse(dados);

  if (!validacao.success) {
    return { erro: 'Confira os dados informados.', campos: agruparErros(validacao.error.issues) };
  }

  try {
    await apiComSessao<Servico>(id ? `/servicos/${id}` : '/servicos', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(validacao.data),
    });
  } catch (erro) {
    return traduzirErro(erro);
  }

  revalidatePath('/painel/servicos');
  redirect('/painel/servicos');
}

/** Desativa o serviço. Ele some das listas novas, mas o histórico permanece. */
export async function desativarServico(id: string): Promise<ResultadoAcao> {
  try {
    await apiComSessao<Servico>(`/servicos/${id}`, { method: 'DELETE' });
  } catch (erro) {
    return traduzirErro(erro);
  }

  revalidatePath('/painel/servicos');
  return {};
}

function traduzirErro(erro: unknown): ResultadoAcao {
  if (erro instanceof ApiRequestError) {
    return { erro: erro.erro.mensagem, campos: erro.erro.detalhes };
  }

  return { erro: 'Não foi possível salvar. Tente novamente.' };
}

function agruparErros(issues: { path: PropertyKey[]; message: string }[]) {
  const campos: Record<string, string[]> = {};

  for (const issue of issues) {
    const campo = issue.path.join('.') || '_';
    (campos[campo] ??= []).push(issue.message);
  }

  return campos;
}
