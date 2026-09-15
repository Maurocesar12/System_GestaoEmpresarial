'use server';

import { redirect } from 'next/navigation';
import {
  cancelamentoContaSchema,
  type CancelamentoContaInput,
  type ContaCancelada,
} from '@gestao/shared-types';
import { erroDeValidacao, traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';
import { limparSessao } from '@/lib/sessao';

export async function cancelarConta(dados: CancelamentoContaInput): Promise<ResultadoAcao> {
  const validacao = cancelamentoContaSchema.safeParse(dados);

  if (!validacao.success) {
    return erroDeValidacao(validacao.error.issues);
  }

  let conta: ContaCancelada;

  try {
    conta = await apiComSessao<ContaCancelada>('/conta/cancelar', {
      method: 'POST',
      body: JSON.stringify(validacao.data),
    });
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível cancelar a conta. Tente novamente.');
  }

  // A API já revogou os refresh tokens; apagar os cookies tira o access token
  // que ainda valeria por alguns minutos neste navegador.
  await limparSessao();
  redirect(`/conta-cancelada?exclusao=${conta.exclusaoPrevistaEm}`);
}
