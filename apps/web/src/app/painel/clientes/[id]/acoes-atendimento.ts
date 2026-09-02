'use server';

import { revalidatePath } from 'next/cache';
import {
  atendimentoFormSchema,
  type Atendimento,
  type AtendimentoFormInput,
} from '@gestao/shared-types';
import { primeiroErro, traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

export type { ResultadoAcao } from '@/lib/acoes';

export async function registrarAtendimento(
  clienteId: string,
  dados: AtendimentoFormInput,
): Promise<ResultadoAcao> {
  const validacao = atendimentoFormSchema.safeParse(dados);

  if (!validacao.success) {
    return primeiroErro(validacao.error.issues);
  }

  try {
    await apiComSessao<Atendimento>(`/clientes/${clienteId}/atendimentos`, {
      method: 'POST',
      body: JSON.stringify(validacao.data),
    });
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível registrar. Tente novamente.');
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
    return traduzirErroAcao(erro, 'Não foi possível excluir. Tente novamente.');
  }

  revalidatePath(`/painel/clientes/${clienteId}`);
  return {};
}
