'use server';

import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { exclusaoHistoricoSchema, type ResultadoExclusaoHistorico } from '@gestao/shared-types';
import { primeiroErro, traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

/**
 * Ações do histórico.
 *
 * A exclusão é sempre em lote — de um só registro ou de vários. Um caminho só
 * significa uma regra só: a mesma validação, o mesmo tratamento de erro e a
 * mesma contagem do que saiu de fato, sem duas versões para divergirem.
 */

const ROTA = '/painel/historico';

export interface ResultadoExclusao extends ResultadoAcao {
  /** Quantos registros saíram. Ausente quando a exclusão falhou. */
  removidos?: number;
}

export async function removerHistorico(id: string): Promise<ResultadoExclusao> {
  return removerHistoricos([id]);
}

export async function removerHistoricos(ids: string[]): Promise<ResultadoExclusao> {
  // Valida no servidor também: a tela só oferece ids que ela mesma listou, mas
  // uma ação de servidor é um endereço público como qualquer outro.
  const validacao = exclusaoHistoricoSchema.safeParse({ ids: ids.map((id) => id.trim()) });

  if (!validacao.success) {
    return primeiroErro(validacao.error.issues, 'Selecione um histórico válido para excluir.');
  }

  try {
    const { removidos } = await apiComSessao<ResultadoExclusaoHistorico>('/auditoria', {
      method: 'DELETE',
      body: JSON.stringify(validacao.data),
    });

    // Recarrega a listagem antes de responder: é o servidor que decide quais
    // linhas restaram, inclusive as que outra pessoa apagou enquanto isso.
    revalidatePath(ROTA);

    if (removidos === 0) {
      return { erro: 'Estes registros já não existiam mais. A lista foi atualizada.' };
    }

    return { removidos };
  } catch (erro) {
    // Sessão expirada vira `redirect()` dentro de `apiComSessao`, e o Next
    // sinaliza isso lançando um erro próprio. Sem devolvê-lo ao Next, a ida
    // para a tela de entrada viraria uma mensagem de erro genérica na tela.
    unstable_rethrow(erro);

    // Pode ter sido um 404 de linha já apagada: a lista precisa ser refeita de
    // qualquer forma, para o usuário não tentar de novo no que não existe.
    revalidatePath(ROTA);

    return traduzirErroAcao(
      erro,
      ids.length > 1
        ? 'Não foi possível excluir os históricos selecionados.'
        : 'Não foi possível excluir este histórico. Tente novamente.',
    );
  }
}
