'use server';

import { revalidatePath } from 'next/cache';
import { fechamentoComissaoSchema, type FechamentoComissao } from '@gestao/shared-types';
import { primeiroErro, traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

export async function fecharComissoes(dados: {
  usuarioId: string;
  de: string;
  ate: string;
  vencimento: string;
}): Promise<ResultadoAcao & { fechamento?: FechamentoComissao }> {
  const validacao = fechamentoComissaoSchema.safeParse(dados);
  if (!validacao.success) return primeiroErro(validacao.error.issues);

  try {
    const fechamento = await apiComSessao<FechamentoComissao>('/comissoes/fechar', {
      method: 'POST',
      body: JSON.stringify(validacao.data),
    });

    revalidatePath('/painel/comissoes');
    revalidatePath('/painel/financeiro', 'layout');
    return { fechamento };
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível fechar as comissões.');
  }
}
