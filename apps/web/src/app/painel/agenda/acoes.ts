'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type {
  AcaoAgendamento,
  Agendamento,
  AgendamentoFormEntrada,
  RecebimentoExecucaoEntrada,
} from '@gestao/shared-types';
import { traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { cabecalhoVersao } from '@/lib/api';
import { apiComSessao } from '@/lib/api-servidor';

/** `versao`: a que a tela abriu ao editar; se mudou, a API recusa com 409. */
export async function salvarAgendamento(
  id: string | null,
  dados: AgendamentoFormEntrada,
  versao?: number,
): Promise<ResultadoAcao> {
  try {
    await apiComSessao<Agendamento>(id ? `/agendamentos/${id}` : '/agendamentos', {
      method: id ? 'PATCH' : 'POST',
      headers: id ? cabecalhoVersao(versao) : undefined,
      body: JSON.stringify(dados),
    });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  revalidatePath('/painel/agenda');
  redirect('/painel/agenda');
}

/**
 * @param materiais Só na execução. Ausente deixa a API usar a lista padrão do serviço.
 * @param recebimento Só na execução. Ausente não lança nada no financeiro.
 */
export async function mudarStatusAgendamento(
  id: string,
  acao: AcaoAgendamento,
  materiais?: Array<{ materialId: string; quantidade: string }>,
  recebimento?: RecebimentoExecucaoEntrada,
): Promise<ResultadoAcao> {
  try {
    await apiComSessao<Agendamento>(`/agendamentos/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ acao, materiais, recebimento }),
    });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  revalidatePath('/painel/agenda');

  // Marcar como executado cria um atendimento no histórico do cliente, baixa
  // materiais, gera comissão e pode lançar a receita — todas essas telas
  // precisam refletir isso.
  revalidatePath('/painel/clientes', 'layout');
  revalidatePath('/painel/financeiro', 'layout');
  revalidatePath('/painel', 'page');
  revalidatePath('/painel/estoque', 'layout');
  revalidatePath('/painel/comissoes');
  revalidatePath('/painel/minhas-comissoes');
  return {};
}
