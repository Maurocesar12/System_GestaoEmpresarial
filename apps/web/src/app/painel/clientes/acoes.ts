'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { clienteFormSchema, type Cliente, type ClienteFormInput } from '@gestao/shared-types';
import { ApiRequestError } from '@/lib/api';
import { apiComSessao } from '@/lib/api-servidor';

/**
 * Ações de clientes.
 *
 * Rodam no servidor, com o token lido do cookie `httpOnly`. O navegador nunca
 * fala com a API diretamente — é isso que permite o token ser inacessível a
 * qualquer script da página.
 */

export interface ResultadoAcao {
  erro?: string;
  campos?: Record<string, string[]>;
}

export async function salvarCliente(
  id: string | null,
  dados: ClienteFormInput,
): Promise<ResultadoAcao> {
  // Valida no servidor também. A validação do formulário é conveniência para
  // quem digita; esta é a que vale.
  const validacao = clienteFormSchema.safeParse(dados);

  if (!validacao.success) {
    return { erro: 'Confira os dados informados.', campos: agruparErros(validacao.error.issues) };
  }

  try {
    await apiComSessao<Cliente>(id ? `/clientes/${id}` : '/clientes', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(validacao.data),
    });
  } catch (erro) {
    return traduzirErro(erro);
  }

  // Sem isto, a listagem continuaria mostrando o conteúdo em cache e o cliente
  // recém-salvo pareceria não ter sido gravado.
  revalidatePath('/painel/clientes');
  redirect('/painel/clientes');
}

export async function removerCliente(id: string): Promise<ResultadoAcao> {
  try {
    await apiComSessao<void>(`/clientes/${id}`, { method: 'DELETE' });
  } catch (erro) {
    return traduzirErro(erro);
  }

  revalidatePath('/painel/clientes');
  redirect('/painel/clientes');
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
