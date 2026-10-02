'use server';

import { revalidatePath } from 'next/cache';
import type { FechamentoComissao } from '@gestao/shared-types';
import { traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

export async function fecharComissoes(dados: {
  usuarioId: string;
  de: string;
  ate: string;
  vencimento: string;
}): Promise<ResultadoAcao & { fechamento?: FechamentoComissao }> {
  try {
    const fechamento = await apiComSessao<FechamentoComissao>('/comissoes/fechar', {
      method: 'POST',
      body: JSON.stringify(dados),
    });

    revalidatePath('/painel/comissoes');
    revalidatePath('/painel/financeiro', 'layout');
    return { fechamento };
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível fechar as comissões.');
  }
}
