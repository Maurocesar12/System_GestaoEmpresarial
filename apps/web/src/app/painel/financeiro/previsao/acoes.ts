'use server';

import {
  gerarPrevisaoFinanceiraSchema,
  type PrevisaoFinanceiraResponse,
} from '@gestao/shared-types';
import { traduzirErroAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

export async function gerarPrevisao(dados: {
  mesesHistorico: number;
  mesesProjecao: number;
}): Promise<{ dados?: PrevisaoFinanceiraResponse; erro?: string }> {
  const validacao = gerarPrevisaoFinanceiraSchema.safeParse(dados);
  if (!validacao.success) return { erro: validacao.error.issues[0]?.message ?? 'Dados inválidos.' };

  try {
    return {
      dados: await apiComSessao<PrevisaoFinanceiraResponse>('/ia/previsao-financeira', {
        method: 'POST',
        body: JSON.stringify(validacao.data),
      }),
    };
  } catch (erro) {
    return traduzirErroAcao(erro);
  }
}
