'use server';

import { revalidatePath } from 'next/cache';
import {
  proLaboreFormSchema,
  type ProLabore,
  type ProLaboreFormEntrada,
} from '@gestao/shared-types';
import { erroDeValidacao, traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

/**
 * Define o pró-labore a partir de uma data.
 *
 * Recebe a entrada **antes** da transformação do schema (`ProLaboreFormEntrada`)
 * porque o valor chega como a pessoa digitou — "5.000,00" — e é o
 * `dinheiroDigitadoSchema` que converte para decimal. Aceitar o tipo já
 * transformado obrigaria a tela a fazer essa conversão por conta própria, que é
 * exatamente onde R$ 250,00 já virou R$ 25.000,00 uma vez neste projeto.
 */
export async function definirProLabore(dados: ProLaboreFormEntrada): Promise<ResultadoAcao> {
  const validacao = proLaboreFormSchema.safeParse(dados);

  if (!validacao.success) {
    return erroDeValidacao(validacao.error.issues);
  }

  try {
    await apiComSessao<ProLabore>('/financeiro/pro-labore', {
      method: 'POST',
      body: JSON.stringify(validacao.data),
    });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  revalidatePath('/painel/financeiro', 'layout');
  return {};
}

export async function removerProLabore(id: string): Promise<ResultadoAcao> {
  try {
    await apiComSessao<void>(`/financeiro/pro-labore/${id}`, { method: 'DELETE' });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  revalidatePath('/painel/financeiro', 'layout');
  return {};
}
