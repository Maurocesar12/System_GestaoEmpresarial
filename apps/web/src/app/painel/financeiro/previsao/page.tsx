import type { Metadata } from 'next';
import Link from 'next/link';
import type { PlanoAtualResponse, PrevisaoFinanceiraResponse } from '@gestao/shared-types';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { estilosBotao } from '@/components/ui/botao';
import { Cartao, CartaoConteudo } from '@/components/ui/cartao';
import { apiComSessao } from '@/lib/api-servidor';
import { GeradorPrevisao } from './gerador-previsao';

export const metadata: Metadata = { title: 'Previsão financeira' };

export default async function PaginaPrevisao() {
  const plano = await apiComSessao<PlanoAtualResponse>('/planos/atual');
  const ultima = plano.plano.iaHabilitada
    ? await apiComSessao<PrevisaoFinanceiraResponse | null>('/ia/previsao-financeira/ultima')
    : null;
  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Previsão financeira"
        descricao="Projete o caixa com seu histórico e as contas futuras já registradas."
      />
      {!plano.plano.iaHabilitada ? (
        <Cartao>
          <CartaoConteudo className="flex max-w-2xl flex-col items-start gap-4 p-6">
            <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-medium">
              Recurso do plano Pro
            </span>
            <h2 className="text-xl font-semibold">
              Previsão com IA não faz parte do {plano.plano.nome}
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              No Pro, a empresa pode gerar até 200 previsões por mês e também ganha mais vagas para
              usuários e clientes.
            </p>
            <Link href="/painel/plano" className={estilosBotao()}>
              Conhecer o plano Pro
            </Link>
          </CartaoConteudo>
        </Cartao>
      ) : (
        <GeradorPrevisao modo={plano.integracaoIa.modo} resultadoInicial={ultima} />
      )}
    </div>
  );
}
