'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { clienteFormSchema, type Cliente, type ClienteFormInput } from '@gestao/shared-types';
import { erroDeValidacao, traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

/**
 * Ações de clientes.
 *
 * Rodam no servidor, com o token lido do cookie `httpOnly`. O navegador nunca
 * fala com a API diretamente — é isso que permite o token ser inacessível a
 * qualquer script da página.
 */

export type { ResultadoAcao } from '@/lib/acoes';

export async function salvarCliente(
  id: string | null,
  dados: ClienteFormInput,
): Promise<ResultadoAcao> {
  // Valida no servidor também. A validação do formulário é conveniência para
  // quem digita; esta é a que vale.
  const validacao = clienteFormSchema.safeParse(dados);

  if (!validacao.success) {
    return erroDeValidacao(validacao.error.issues);
  }

  try {
    await apiComSessao<Cliente>(id ? `/clientes/${id}` : '/clientes', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(validacao.data),
    });
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível salvar. Tente novamente.');
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
    return traduzirErroAcao(erro, 'Não foi possível salvar. Tente novamente.');
  }

  revalidatePath('/painel/clientes');
  redirect('/painel/clientes');
}
