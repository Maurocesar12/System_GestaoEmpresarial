import type { Metadata } from 'next';
import Link from 'next/link';
import type {
  CategoriaFinanceira,
  Cliente,
  Lancamento,
  Paginado,
  Servico,
} from '@gestao/shared-types';
import { apiComSessao } from '@/lib/api-servidor';
import { FormularioLancamento } from '../formulario-lancamento';
import { BotaoRemoverLancamento } from './botao-remover';

export const metadata: Metadata = {
  title: 'Lançamento — Gestão Empresarial',
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PaginaLancamento({ params }: Props) {
  const { id } = await params;

  const [lancamento, categorias, servicos, clientes] = await Promise.all([
    apiComSessao<Lancamento>(`/financeiro/lancamentos/${id}`),
    apiComSessao<CategoriaFinanceira[]>('/financeiro/categorias'),
    apiComSessao<Paginado<Servico>>('/servicos?porPagina=100&somenteAtivos=true'),
    apiComSessao<Paginado<Cliente>>('/clientes?porPagina=100'),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Link
          href="/painel/financeiro"
          className="text-muted-foreground hover:text-foreground w-fit text-sm underline-offset-4 hover:underline"
        >
          ← Financeiro
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight">{lancamento.descricao}</h1>
      </div>

      <FormularioLancamento
        lancamento={lancamento}
        categorias={categorias}
        servicos={servicos.dados}
        clientes={clientes.dados}
      />

      <section className="border-destructive/30 flex flex-col gap-3 rounded-lg border border-dashed p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">Excluir lançamento</h2>
          <p className="text-muted-foreground text-sm">
            O valor sai do fluxo de caixa e da margem do período. Não há como desfazer.
          </p>
        </div>

        <BotaoRemoverLancamento id={lancamento.id} />
      </section>
    </div>
  );
}
