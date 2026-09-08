import type { Metadata } from 'next';
import type { PlanoAtualResponse, PrevisaoFinanceiraResponse } from '@gestao/shared-types';
import { unstable_rethrow } from 'next/navigation';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { ApiRequestError } from '@/lib/api';
import { apiComSessao } from '@/lib/api-servidor';
import { GeradorPrevisao } from './gerador-previsao';

export const metadata: Metadata = { title: 'Previsão financeira' };

export default async function PaginaPrevisao() {
  const plano = await apiComSessao<PlanoAtualResponse>('/planos/atual');
  const { erro, ultima } = await carregarUltimaPrevisao();

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Previsão financeira"
        descricao="Projete o caixa com seu histórico e as contas futuras já registradas."
      />
      <GeradorPrevisao
        erroInicial={erro}
        modo={plano.integracaoIa.modo}
        limiteMensal={plano.limites.previsoesIaMensais}
        pacotePagoAtivo={plano.plano.iaHabilitada}
        resultadoInicial={ultima}
      />
    </div>
  );
}

async function carregarUltimaPrevisao(): Promise<{
  erro?: string;
  ultima: PrevisaoFinanceiraResponse | null;
}> {
  try {
    return {
      ultima: await apiComSessao<PrevisaoFinanceiraResponse | null>(
        '/ia/previsao-financeira/ultima',
      ),
    };
  } catch (erro) {
    unstable_rethrow(erro);

    return {
      erro: mensagemDaApi(erro, 'Não foi possível carregar a última previsão.'),
      ultima: null,
    };
  }
}

function mensagemDaApi(erro: unknown, fallback: string): string {
  return erro instanceof ApiRequestError ? erro.message : fallback;
}
