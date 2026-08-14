'use server';

import { revalidatePath } from 'next/cache';
import {
  atendimentoFormSchema,
  type Atendimento,
  type AtendimentoFormInput,
} from '@gestao/shared-types';
import { ApiRequestError } from '@/lib/api';
import { apiComSessao } from '@/lib/api-servidor';

export interface ResultadoAcao {
  erro?: string;
}

export async function registrarAtendimento(
  clienteId: string,
  dados: AtendimentoFormInput,
): Promise<ResultadoAcao> {
  const validacao = atendimentoFormSchema.safeParse(dados);

  if (!validacao.success) {
    return { erro: validacao.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  try {
    await apiComSessao<Atendimento>(`/clientes/${clienteId}/atendimentos`, {
      method: 'POST',
      body: JSON.stringify(validacao.data),
    });
  } catch (erro) {
    return traduzirErro(erro);
  }

  // Sem `revalidatePath`, o atendimento recém-criado não apareceria na lista:
  // a página é renderizada no servidor e continuaria servindo a versão anterior.
  revalidatePath(`/painel/clientes/${clienteId}`);
  return {};
}

export async function removerAtendimento(
  clienteId: string,
  atendimentoId: string,
): Promise<ResultadoAcao> {
  try {
    // A rota é aninhada em cliente: `/clientes/:clienteId/atendimentos/:id`.
    // Os dois ids são necessários, e são diferentes.
    await apiComSessao<void>(`/clientes/${clienteId}/atendimentos/${atendimentoId}`, {
      method: 'DELETE',
    });
  } catch (erro) {
    return traduzirErro(erro);
  }

  revalidatePath(`/painel/clientes/${clienteId}`);
  return {};
}

function traduzirErro(erro: unknown): ResultadoAcao {
  if (erro instanceof ApiRequestError) {
    return { erro: erro.erro.mensagem };
  }

  return { erro: 'Não foi possível registrar. Tente novamente.' };
}
