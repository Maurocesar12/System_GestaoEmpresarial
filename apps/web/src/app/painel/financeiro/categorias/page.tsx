import type { Metadata } from 'next';
import Link from 'next/link';
import type { CategoriaFinanceira } from '@gestao/shared-types';
import { apiComSessao } from '@/lib/api-servidor';
import { GerenciadorCategorias } from './gerenciador';

export const metadata: Metadata = {
  title: 'Categorias — Gestão Empresarial',
};

export default async function PaginaCategorias() {
  const categorias = await apiComSessao<CategoriaFinanceira[]>('/financeiro/categorias');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Link
          href="/painel/financeiro"
          className="text-muted-foreground hover:text-foreground w-fit text-sm underline-offset-4 hover:underline"
        >
          ← Financeiro
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight">Categorias</h1>

        <p className="text-muted-foreground text-sm">
          Como você agrupa as saídas. A classificação em fixo ou variável é o que permite calcular
          seu custo operacional.
        </p>
      </div>

      <GerenciadorCategorias categorias={categorias} />

      <section className="text-muted-foreground flex flex-col gap-2 rounded-lg border border-dashed p-4 text-sm">
        <p className="text-foreground font-medium">Fixo ou variável?</p>
        <p>
          <strong className="text-foreground">Fixo</strong> custa o mesmo independente do movimento:
          aluguel, internet, contador, seguro.
        </p>
        <p>
          <strong className="text-foreground">Variável</strong> acompanha o volume de trabalho:
          combustível, material de consumo, comissão.
        </p>
      </section>
    </div>
  );
}
