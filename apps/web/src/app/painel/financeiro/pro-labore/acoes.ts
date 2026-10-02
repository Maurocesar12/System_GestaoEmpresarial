'use server';

import { revalidatePath } from 'next/cache';
import type { ProLabore, ProLaboreFormEntrada, SimulacaoProLabore } from '@gestao/shared-types';
import { traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

/**
 * Define o prÃ³-labore a partir de uma data.
 *
 * Recebe a entrada **antes** da transformaÃ§Ã£o do schema (`ProLaboreFormEntrada`)
 * porque o valor chega como a pessoa digitou â€” "5.000,00" â€” e Ã© o
 * `dinheiroDigitadoSchema` que converte para decimal. Aceitar o tipo jÃ¡
 * transformado obrigaria a tela a fazer essa conversÃ£o por conta prÃ³pria, que Ã©
 * exatamente onde R$ 250,00 jÃ¡ virou R$ 25.000,00 uma vez neste projeto.
 */
export async function definirProLabore(dados: ProLaboreFormEntrada): Promise<ResultadoAcao> {
  try {
    await apiComSessao<ProLabore>('/financeiro/pro-labore', {
      method: 'POST',
      body: JSON.stringify(dados),
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

/** PrÃ©via "cabe no teto?", calculada pela API. Erro sÃ³ some com a prÃ©via. */
export async function simularProLabore(dados: {
  valor: string;
  meses: string;
}): Promise<{ dados?: SimulacaoProLabore }> {
  try {
    return {
      dados: await apiComSessao<SimulacaoProLabore>('/financeiro/pro-labore/simular', {
        method: 'POST',
        body: JSON.stringify(dados),
      }),
    };
  } catch {
    return {};
  }
}
