'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  clienteFormSchema,
  importacaoClientesSchema,
  type Cliente,
  type ClienteFormInput,
  type ResultadoImportacao,
} from '@gestao/shared-types';
import { erroDeValidacao, traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

/**
 * Ações de clientes.
 *
 * Rodam no servidor, com o token lido do cookie `httpOnly`. O navegador nunca
 * fala com a API diretamente — é isso que permite o token ser inacessível a
 * qualquer script da página.
 */

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
    return traduzirErroAcao(erro, 'Não foi possível excluir. Tente novamente.');
  }

  revalidatePath('/painel/clientes');
  redirect('/painel/clientes');
}

/**
 * Envia um lote de clientes vindo da planilha.
 *
 * A tela quebra a planilha em lotes e chama esta ação uma vez por lote, em
 * série. Em série de propósito: lotes paralelos disputariam a trava do tenant
 * que o guard de limite usa, e um deles esperaria o outro de qualquer forma —
 * só que sem a tela conseguir mostrar progresso honesto.
 *
 * Não redireciona nem revalida: quem faz isso é a tela, ao final de todos os
 * lotes. Revalidar a cada lote recarregaria a listagem várias vezes à toa.
 */
export async function importarClientes(
  clientes: ClienteFormInput[],
): Promise<ResultadoAcao & { resultado?: ResultadoImportacao }> {
  const validacao = importacaoClientesSchema.safeParse({ clientes });

  if (!validacao.success) {
    return erroDeValidacao(validacao.error.issues);
  }

  try {
    const resultado = await apiComSessao<ResultadoImportacao>('/clientes/importar', {
      method: 'POST',
      body: JSON.stringify(validacao.data),
    });

    return { resultado };
  } catch (erro) {
    // O limite de plano volta como 403 com mensagem explicando quantas vagas
    // restam — vale a pena mostrar o texto da API em vez de um genérico.
    return traduzirErroAcao(erro, 'Não foi possível importar. Tente novamente.');
  }
}

/** Atualiza a listagem depois que todos os lotes terminaram. */
export async function revalidarClientes(): Promise<void> {
  revalidatePath('/painel/clientes', 'layout');
}
