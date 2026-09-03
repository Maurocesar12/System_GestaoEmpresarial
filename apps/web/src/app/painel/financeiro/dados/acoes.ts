'use server';

import { revalidatePath } from 'next/cache';
import {
  importacaoLancamentosSchema,
  type ImportacaoLancamentosInput,
  type ResultadoImportacaoLancamentos,
} from '@gestao/shared-types';
import { erroDeValidacao, traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

export async function importarLancamentos(
  dados: ImportacaoLancamentosInput,
): Promise<ResultadoAcao & { criados?: number }> {
  const validacao = importacaoLancamentosSchema.safeParse(dados);
  if (!validacao.success) return erroDeValidacao(validacao.error.issues);
  try {
    const resultado = await apiComSessao<ResultadoImportacaoLancamentos>(
      '/financeiro/dados/importar',
      { method: 'POST', body: JSON.stringify(validacao.data) },
    );
    revalidatePath('/painel/financeiro', 'layout');
    return { criados: resultado.criados };
  } catch (erro) {
    return traduzirErroAcao(erro);
  }
}
