'use server';

import type { PrevisaoFinanceiraResponse } from '@gestao/shared-types';
import { traduzirErroAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

export async function gerarPrevisao(dados: {
  mesesHistorico: number;
  mesesProjecao: number;
}): Promise<{ dados?: PrevisaoFinanceiraResponse; erro?: string }> {
  try {
    return {
      dados: await apiComSessao<PrevisaoFinanceiraResponse>('/ia/previsao-financeira', {
        method: 'POST',
        body: JSON.stringify(dados),
      }),
    };
  } catch (erro) {
    return traduzirErroAcao(erro);
  }
}
