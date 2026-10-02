'use server';

import { redirect } from 'next/navigation';
import type { CancelamentoContaInput, ContaCancelada } from '@gestao/shared-types';
import { traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';
import { limparSessao } from '@/lib/sessao';

export async function cancelarConta(dados: CancelamentoContaInput): Promise<ResultadoAcao> {
  let conta: ContaCancelada;

  try {
    conta = await apiComSessao<ContaCancelada>('/conta/cancelar', {
      method: 'POST',
      body: JSON.stringify(dados),
    });
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível cancelar a conta. Tente novamente.');
  }

  // A API já revogou os refresh tokens; apagar os cookies tira o access token
  // que ainda valeria por alguns minutos neste navegador.
  await limparSessao();
  redirect(`/conta-cancelada?exclusao=${conta.exclusaoPrevistaEm}`);
}
