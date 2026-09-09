import type { Metadata } from 'next';
import Link from 'next/link';
import type { ConfiguracoesEmpresa, QuadroFunil } from '@gestao/shared-types';
import { Settings2, UserPlus } from 'lucide-react';
import { estilosBotao } from '@/components/ui/botao';
import { apiComSessao } from '@/lib/api-servidor';
import { Quadro } from './quadro';

export const metadata: Metadata = {
  title: 'Funil',
};

export default async function PaginaFunil() {
  const [quadro, configuracoes] = await Promise.all([
    apiComSessao<QuadroFunil>('/funil'),
    apiComSessao<ConfiguracoesEmpresa>('/configuracoes'),
  ]);

  const totalNoFunil = quadro.colunas.reduce((soma, coluna) => soma + coluna.clientes.length, 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase">
            CRM
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Pipeline comercial</h1>
          <p className="text-muted-foreground text-sm">
            {totalNoFunil === 0
              ? 'Nenhum cliente no funil ainda.'
              : `${totalNoFunil} ${totalNoFunil === 1 ? 'cliente' : 'clientes'} em negociação.`}
            {quadro.totalForaDoFunil > 0 && (
              <>
                {' '}
                <Link
                  href="/painel/clientes"
                  className="text-foreground underline underline-offset-4"
                >
                  {quadro.totalForaDoFunil} fora do funil
                </Link>
                .
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/painel/funil/etapas" className={estilosBotao({ variante: 'secundario' })}>
            <Settings2 aria-hidden />
            Etapas
          </Link>
          <Link href="/painel/clientes/novo" className={estilosBotao()}>
            <UserPlus aria-hidden />
            Novo cliente
          </Link>
        </div>
      </header>

      {totalNoFunil === 0 && quadro.totalForaDoFunil === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="font-medium">Cadastre um cliente para começar</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            O funil mostra em que ponto da negociação cada cliente está, e há quanto tempo ele não
            sai do lugar.
          </p>
          <Link
            href="/painel/clientes/novo"
            className="bg-primary text-primary-foreground hover:bg-primary/90 mt-2 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
          >
            Novo cliente
          </Link>
        </div>
      ) : (
        <Quadro quadro={quadro} etiquetas={configuracoes.etiquetas} />
      )}
    </div>
  );
}
