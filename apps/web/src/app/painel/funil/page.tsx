import type { Metadata } from 'next';
import Link from 'next/link';
import type { QuadroFunil } from '@gestao/shared-types';
import { apiComSessao } from '@/lib/api-servidor';
import { Quadro } from './quadro';

export const metadata: Metadata = {
  title: 'Funil — Gestão Empresarial',
};

export default async function PaginaFunil() {
  const quadro = await apiComSessao<QuadroFunil>('/funil');

  const totalNoFunil = quadro.colunas.reduce((soma, coluna) => soma + coluna.clientes.length, 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Funil</h1>
          <Link
            href="/painel/funil/etapas"
            className="text-muted-foreground hover:text-foreground order-last w-fit text-xs underline-offset-4 hover:underline"
          >
            configurar etapas
          </Link>
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
        <Quadro quadro={quadro} />
      )}
    </div>
  );
}
