import type { Metadata } from 'next';
import type { PlanoAtualResponse, PrevisaoFinanceiraResponse } from '@gestao/shared-types';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { apiComSessao } from '@/lib/api-servidor';
import { GeradorPrevisao } from './gerador-previsao';

export const metadata: Metadata = { title: 'Previsão financeira' };

export default async function PaginaPrevisao() {
  const plano = await apiComSessao<PlanoAtualResponse>('/planos/atual');
  const ultima = await apiComSessao<PrevisaoFinanceiraResponse | null>(
    '/ia/previsao-financeira/ultima',
  );
  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Previsão financeira"
        descricao="Projete o caixa com seu histórico e as contas futuras já registradas."
      />
      <GeradorPrevisao
        modo={plano.integracaoIa.modo}
        limiteMensal={plano.limites.previsoesIaMensais}
        pacotePagoAtivo={plano.plano.iaHabilitada}
        resultadoInicial={ultima}
      />
    </div>
  );
}
