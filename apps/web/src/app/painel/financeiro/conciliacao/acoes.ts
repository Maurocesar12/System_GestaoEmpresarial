'use server';

import type { ConciliacaoAnalisada } from '@gestao/shared-types';
import { traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

/**
 * Manda o extrato, como saiu do arquivo, para a API analisar.
 *
 * Nada é gravado: a API devolve as movimentações entendidas, as contas em
 * aberto candidatas e a sugestão de vínculo de cada uma.
 */
export async function analisarExtrato(dados: {
  cabecalhos: string[];
  linhas: string[][];
}): Promise<ResultadoAcao & { analise?: ConciliacaoAnalisada }> {
  try {
    return {
      analise: await apiComSessao<ConciliacaoAnalisada>('/financeiro/conciliacao/analisar', {
        method: 'POST',
        body: JSON.stringify(dados),
      }),
    };
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível analisar o extrato.');
  }
}
