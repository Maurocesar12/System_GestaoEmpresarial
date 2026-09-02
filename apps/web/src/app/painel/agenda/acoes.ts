'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  agendamentoFormSchema,
  type AcaoAgendamento,
  type Agendamento,
  type AgendamentoFormInput,
} from '@gestao/shared-types';
import { erroDeValidacao, traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
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

export async function mudarStatusAgendamento(
  id: string,
  acao: AcaoAgendamento,
): Promise<ResultadoAcao> {
  try {
    await apiComSessao<Agendamento>(`/agendamentos/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ acao }),
    });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  revalidatePath('/painel/agenda');

  // Marcar como executado cria um atendimento no histórico do cliente — a
  // ficha dele precisa refletir isso na próxima visita.
  revalidatePath('/painel/clientes', 'layout');
  return {};
}
