import Link from 'next/link';
import { Activity, KanbanSquare } from 'lucide-react';
import { formatarBRL, type BlocoFunil, type PainelTempoReal } from '@gestao/shared-types';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { Selo } from '@/components/ui/selo';

/** Resumo do funil e das contas em aberto no painel. */

/**
 * O funil inteiro numa coluna estreita.
 *
 * Barras horizontais em vez do kanban: aqui a pergunta não é "quem está em
 * cada etapa", é "onde o dinheiro está travado". A largura da barra compara as
 * etapas de relance; o valor escrito ao lado é o que se lê com precisão.
 */
export function BlocoDoFunil({ funil }: { funil: BlocoFunil }) {
  const maior = Math.max(1, ...funil.etapas.map((etapa) => etapa.clientes));

  return (
    <Cartao className="flex flex-col">
      <CartaoCabecalho>
        <CartaoTitulo className="flex items-center gap-2">
          <KanbanSquare aria-hidden className="text-muted-foreground size-4" />
          Funil de vendas
        </CartaoTitulo>

        <Link
          href="/painel/funil"
          className="text-muted-foreground hover:text-foreground shrink-0 text-xs underline-offset-4 transition-colors hover:underline"
        >
          ver quadro
        </Link>
      </CartaoCabecalho>

      {funil.etapas.length === 0 ? (
        <p className="text-muted-foreground flex-1 px-4 py-10 text-center text-sm">
          Nenhuma etapa configurada.
        </p>
      ) : (
        <CartaoConteudo className="flex flex-1 flex-col gap-3">
          {funil.etapas.map((etapa) => (
            <div key={etapa.id} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm">{etapa.nome}</span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {etapa.clientes} {Number(etapa.valor) > 0 && `· ${formatarBRL(etapa.valor)}`}
                </span>
              </div>

              <span aria-hidden className="bg-muted block h-1.5 overflow-hidden rounded-full">
                <span
                  className="bg-grafico-1 block h-full rounded-full"
                  style={{ width: `${(etapa.clientes / maior) * 100}%` }}
                />
              </span>
            </div>
          ))}
        </CartaoConteudo>
      )}

      <p className="text-muted-foreground border-t px-4 py-2.5 text-xs">
        {funil.total} cliente(s) no funil
        {funil.foraDoFunil > 0 && ` · ${funil.foraDoFunil} fora dele`}
      </p>
    </Cartao>
  );
}

/**
 * O que ainda não virou dinheiro.
 *
 * A pagar e a receber separados, e os vencidos destacados: são ações opostas —
 * um é multa correndo, o outro é cobrança a fazer. Somados num número só, a
 * única leitura possível seria "tem algo errado".
 */
export function ContasEmAberto({
  financeiro,
}: {
  financeiro: NonNullable<PainelTempoReal['financeiro']>;
}) {
  return (
    <Cartao>
      <CartaoCabecalho>
        <CartaoTitulo className="flex items-center gap-2">
          <Activity aria-hidden className="text-muted-foreground size-4" />
          Contas em aberto
        </CartaoTitulo>

        <Link
          href="/painel/financeiro"
          className="text-muted-foreground hover:text-foreground shrink-0 text-xs underline-offset-4 transition-colors hover:underline"
        >
          ver financeiro
        </Link>
      </CartaoCabecalho>

      <CartaoConteudo className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            A receber
          </p>
          <p className="text-sucesso mt-1 text-xl font-semibold tabular-nums">
            {formatarBRL(financeiro.aReceber)}
          </p>
          {financeiro.vencidosAReceber.quantidade > 0 && (
            <Selo tom="atencao" className="mt-2">
              {financeiro.vencidosAReceber.quantidade} vencida(s) ·{' '}
              {formatarBRL(financeiro.vencidosAReceber.valor)}
            </Selo>
          )}
        </div>

        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            A pagar
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {formatarBRL(financeiro.aPagar)}
          </p>
          {financeiro.vencidosAPagar.quantidade > 0 && (
            <Selo tom="perigo" className="mt-2">
              {financeiro.vencidosAPagar.quantidade} vencida(s) ·{' '}
              {formatarBRL(financeiro.vencidosAPagar.valor)}
            </Selo>
          )}
        </div>
      </CartaoConteudo>
    </Cartao>
  );
}
