'use server';

import { revalidatePath } from 'next/cache';
import type { ResultadoImportacaoLancamentos } from '@gestao/shared-types';
import { traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

export async function importarLancamentos(
  // As células como saíram da planilha; a API normaliza e valida.
  dados: { lancamentos: Record<string, string>[] },
): Promise<ResultadoAcao & { criados?: number }> {
  try {
    const resultado = await apiComSessao<ResultadoImportacaoLancamentos>(
      '/financeiro/dados/importar',
      { method: 'POST', body: JSON.stringify(dados) },
    );
    revalidatePath('/painel/financeiro', 'layout');
    return { criados: resultado.criados };
  } catch (erro) {
    return traduzirErroAcao(erro);
  }
}
