'use server';

import { revalidatePath } from 'next/cache';
import type {
  MovimentacaoFormEntrada,
  Reserva,
  ReservaFormEntrada,
  SimulacaoReserva,
} from '@gestao/shared-types';
import { traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

export async function salvarReserva(
  id: string | null,
  dados: ReservaFormEntrada,
): Promise<ResultadoAcao> {
  try {
    await apiComSessao<Reserva>(id ? `/financeiro/reservas/${id}` : '/financeiro/reservas', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(dados),
    });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  revalidatePath('/painel/financeiro', 'layout');
  return {};
}

/**
 * Guarda ou resgata um valor.
 *
 * A conta do novo saldo fica na API. Fazê-la aqui obrigaria a tela a ler o
 * saldo atual, somar e enviar o total — e duas pessoas guardando ao mesmo tempo
 * fariam a segunda apagar a primeira.
 */
export async function movimentarReserva(
  id: string,
  dados: MovimentacaoFormEntrada,
): Promise<ResultadoAcao> {
  try {
    await apiComSessao<Reserva>(`/financeiro/reservas/${id}/movimentar`, {
      method: 'POST',
      body: JSON.stringify(dados),
    });
  } catch (erro) {
    // A API recusa resgate maior que o guardado e diz quanto há.
    return traduzirErroAcao(erro);
  }

  revalidatePath('/painel/financeiro', 'layout');
  return {};
}

export async function removerReserva(id: string): Promise<ResultadoAcao> {
  try {
    await apiComSessao<void>(`/financeiro/reservas/${id}`, { method: 'DELETE' });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  revalidatePath('/painel/financeiro', 'layout');
  return {};
}

/** Projeção da reserva, calculada pela API. Erro só some com a prévia. */
export async function simularReserva(dados: {
  id: string;
  aporteMensal: string;
  meses: string;
}): Promise<{ dados?: SimulacaoReserva }> {
  try {
    return {
      dados: await apiComSessao<SimulacaoReserva>(`/financeiro/reservas/${dados.id}/simular`, {
        method: 'POST',
        body: JSON.stringify({ aporteMensal: dados.aporteMensal, meses: dados.meses }),
      }),
    };
  } catch {
    return {};
  }
}
