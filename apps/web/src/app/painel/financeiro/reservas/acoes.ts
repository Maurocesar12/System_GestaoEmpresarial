'use server';

import { revalidatePath } from 'next/cache';
import {
  movimentacaoFormSchema,
  reservaFormSchema,
  type MovimentacaoFormEntrada,
  type Reserva,
  type ReservaFormEntrada,
} from '@gestao/shared-types';
import { erroDeValidacao, traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

export async function salvarReserva(
  id: string | null,
  dados: ReservaFormEntrada,
): Promise<ResultadoAcao> {
  const validacao = reservaFormSchema.safeParse(dados);

  if (!validacao.success) {
    return erroDeValidacao(validacao.error.issues);
  }

  try {
    await apiComSessao<Reserva>(id ? `/financeiro/reservas/${id}` : '/financeiro/reservas', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(validacao.data),
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
  const validacao = movimentacaoFormSchema.safeParse(dados);

  if (!validacao.success) {
    return erroDeValidacao(validacao.error.issues);
  }

  try {
    await apiComSessao<Reserva>(`/financeiro/reservas/${id}/movimentar`, {
      method: 'POST',
      body: JSON.stringify(validacao.data),
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
