'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  agendamentoFormSchema,
  type AcaoAgendamento,
  type Agendamento,
  type AgendamentoFormInput,
} from '@gestao/shared-types';
import { ApiRequestError } from '@/lib/api';
import { apiComSessao } from '@/lib/api-servidor';

export interface ResultadoAcao {
  erro?: string;
  campos?: Record<string, string[]>;
}

export async function salvarAgendamento(
  id: string | null,
  dados: AgendamentoFormInput,
): Promise<ResultadoAcao> {
  const validacao = agendamentoFormSchema.safeParse(dados);

  if (!validacao.success) {
    return { erro: 'Confira os dados informados.', campos: agruparErros(validacao.error.issues) };
  }

  try {
    await apiComSessao<Agendamento>(id ? `/agendamentos/${id}` : '/agendamentos', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(validacao.data),
    });
  } catch (erro) {
    return traduzirErro(erro);
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
    return traduzirErro(erro);
  }

  revalidatePath('/painel/agenda');

  // Marcar como executado cria um atendimento no histórico do cliente — a
  // ficha dele precisa refletir isso na próxima visita.
  revalidatePath('/painel/clientes', 'layout');
  return {};
}

export async function removerAgendamento(id: string): Promise<ResultadoAcao> {
  try {
    await apiComSessao<void>(`/agendamentos/${id}`, { method: 'DELETE' });
  } catch (erro) {
    return traduzirErro(erro);
  }

  revalidatePath('/painel/agenda');
  return {};
}

function traduzirErro(erro: unknown): ResultadoAcao {
  if (erro instanceof ApiRequestError) {
    return { erro: erro.erro.mensagem, campos: erro.erro.detalhes };
  }

  return { erro: 'Não foi possível completar a ação. Tente novamente.' };
}

function agruparErros(issues: { path: PropertyKey[]; message: string }[]) {
  const campos: Record<string, string[]> = {};

  for (const issue of issues) {
    const campo = issue.path.join('.') || '_';
    (campos[campo] ??= []).push(issue.message);
  }

  return campos;
}
