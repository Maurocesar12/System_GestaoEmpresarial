'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  agendamentoFormSchema,
  mudarStatusAgendamentoSchema,
  type AcaoAgendamento,
  type Agendamento,
  type AgendamentoFormInput,
} from '@gestao/shared-types';
import {
  erroDeValidacao,
  primeiroErro,
  traduzirErroAcao,
  type ResultadoAcao,
} from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

export async function salvarAgendamento(
  id: string | null,
  dados: AgendamentoFormInput,
): Promise<ResultadoAcao> {
  const validacao = agendamentoFormSchema.safeParse(dados);

  if (!validacao.success) {
    return erroDeValidacao(validacao.error.issues);
  }

  try {
    await apiComSessao<Agendamento>(id ? `/agendamentos/${id}` : '/agendamentos', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(validacao.data),
    });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  revalidatePath('/painel/agenda');
  redirect('/painel/agenda');
}

/**
 * @param materiais Só na execução. Ausente deixa a API usar a lista padrão do serviço.
 */
export async function mudarStatusAgendamento(
  id: string,
  acao: AcaoAgendamento,
  materiais?: Array<{ materialId: string; quantidade: string }>,
): Promise<ResultadoAcao> {
  const validacao = mudarStatusAgendamentoSchema.safeParse({ acao, materiais });

  if (!validacao.success) {
    return primeiroErro(validacao.error.issues);
  }

  try {
    await apiComSessao<Agendamento>(`/agendamentos/${id}/status`, {
      method: 'POST',
      body: JSON.stringify(validacao.data),
    });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  revalidatePath('/painel/agenda');

  // Marcar como executado cria um atendimento no histórico do cliente, baixa
  // materiais e gera comissão — as três telas precisam refletir isso.
  revalidatePath('/painel/clientes', 'layout');
  revalidatePath('/painel/estoque', 'layout');
  revalidatePath('/painel/comissoes');
  revalidatePath('/painel/minhas-comissoes');
  return {};
}
