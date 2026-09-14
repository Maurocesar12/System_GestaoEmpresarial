import type { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import {
  PACOTE_IA_PRECO_MENSAL_BRL,
  type PlanoAtualResponse,
  type PrevisaoFinanceiraResponse,
} from '@gestao/shared-types';
import { unstable_rethrow } from 'next/navigation';
import { estilosBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao, CartaoConteudo } from '@/components/ui/cartao';
import { ApiRequestError } from '@/lib/api';
import { apiComSessao } from '@/lib/api-servidor';
import { GeradorPrevisao } from './gerador-previsao';

export const metadata: Metadata = { title: 'Previsão financeira' };

export default async function PaginaPrevisao() {
  const plano = await apiComSessao<PlanoAtualResponse>('/planos/atual');

  if (!plano.plano.iaHabilitada) {
    return <PrevisaoNoPremium planoNome={plano.plano.nome} />;
  }

  const { erro, ultima } = await carregarUltimaPrevisao();

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Previsão financeira"
        descricao="Projete o caixa com o histórico, as contas futuras, o funil e os compromissos já registrados."
      />
      <GeradorPrevisao
        erroInicial={erro}
        modo={plano.integracaoIa.modo}
        limiteMensal={plano.limites.previsoesIaMensais}
        resultadoInicial={ultima}
      />
    </div>
  );
}

/**
 * A tela para quem não tem o recurso.
 *
 * Não é um aviso de bloqueio em cima de uma tela inutilizável: é uma página
 * própria, que explica o que a previsão faz e o que o plano atual continua
 * fazendo. Mostrar o gerador desabilitado só ensinaria a clicar em algo que
 * sempre falha.
 */
function PrevisaoNoPremium({ planoNome }: { planoNome: string }) {
  const recursos = [
    'Projeção de caixa mês a mês, com saldo acumulado.',
    'Propostas em aberto ponderadas pela sua taxa de conversão.',
    'Contas a pagar e a receber já registradas, e as que venceram.',
    'Agendamentos futuros e compromissos recorrentes, como o pró-labore.',
    'Cenários pessimista, base e otimista, com pontos de atenção e ações.',
  ];

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina titulo="Previsão financeira" descricao="Disponível no plano Premium." />

      <Cartao>
        <CartaoConteudo className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
              <Sparkles aria-hidden className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold">O que a previsão com IA entrega</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Ela lê o negócio inteiro, e não só o extrato — é isso que separa uma projeção de uma
                média dos últimos meses.
              </p>
            </div>
          </div>

          <ul className="flex flex-col gap-2">
            {recursos.map((recurso) => (
              <li key={recurso} className="text-muted-foreground flex gap-2 text-sm">
                <span aria-hidden className="bg-primary mt-2 size-1.5 shrink-0 rounded-full" />
                {recurso}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
            <p className="text-muted-foreground text-sm">
              Seu plano <span className="text-foreground font-medium">{planoNome}</span> continua
              com fluxo de caixa, margem por serviço e o assistente de ajuda do sistema.
            </p>

            <Link href="/painel/plano" className={estilosBotao()}>
              Ver o Premium · R$ {PACOTE_IA_PRECO_MENSAL_BRL}/mês
            </Link>
          </div>
        </CartaoConteudo>
      </Cartao>
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
