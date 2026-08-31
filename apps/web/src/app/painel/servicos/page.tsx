import type { Metadata } from 'next';
import Link from 'next/link';
import { formatarBRL, margemPercentual, type Paginado, type Servico } from '@gestao/shared-types';
import { apiComSessao } from '@/lib/api-servidor';

export const metadata: Metadata = {
  title: 'Serviços',
};

export default async function PaginaServicos() {
  const { dados: servicos } = await apiComSessao<Paginado<Servico>>('/servicos?porPagina=100');

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Serviços</h1>
          <p className="text-muted-foreground text-sm">
            O custo base de cada serviço é o que torna a margem calculável.
          </p>
        </div>

        <Link
          href="/painel/servicos/novo"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
        >
          Novo serviço
        </Link>
      </header>

      {servicos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="font-medium">Nenhum serviço cadastrado</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            Cadastre o que você vende, com quanto custa executar. É esse número que permite saber,
            depois, quanto cada tipo de serviço deixa de lucro.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Serviço</th>
                <th className="px-4 py-3 text-right font-medium">Custo</th>
                <th className="px-4 py-3 text-right font-medium">Preço</th>
                <th className="px-4 py-3 text-right font-medium">Margem</th>
              </tr>
            </thead>
            <tbody>
              {servicos.map((servico) => {
                const margem = margemPercentual(servico.custoBase, servico.precoPadrao);

                return (
                  <tr
                    key={servico.id}
                    className={`hover:bg-muted/30 border-t transition-colors ${
                      // Desativado fica visível, mas apagado: some das telas de
                      // uso e continua no histórico.
                      servico.ativo ? '' : 'opacity-50'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/painel/servicos/${servico.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {servico.nome}
                      </Link>
                      <div className="text-muted-foreground text-xs">
                        {servico.categoria ?? '—'}
                        {!servico.ativo && ' · desativado'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatarBRL(servico.custoBase)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {servico.precoPadrao ? formatarBRL(servico.precoPadrao) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {margem === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={
                            margem < 0
                              ? 'text-destructive font-medium'
                              : margem < 20
                                ? 'font-medium text-amber-600 dark:text-amber-400'
                                : 'font-medium text-emerald-600 dark:text-emerald-400'
                          }
                        >
                          {margem.toFixed(0)}%
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
