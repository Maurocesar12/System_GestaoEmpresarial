import type { Metadata } from 'next';
import type { CategoriaFinanceira, Cliente, Paginado, Servico } from '@gestao/shared-types';
import { apiComSessao } from '@/lib/api-servidor';
import { FormularioLancamento } from '../formulario-lancamento';

export const metadata: Metadata = {
  title: 'Novo lançamento — Gestão Empresarial',
};

export default async function PaginaNovoLancamento() {
  const [categorias, servicos, clientes] = await Promise.all([
    apiComSessao<CategoriaFinanceira[]>('/financeiro/categorias'),
    apiComSessao<Paginado<Servico>>('/servicos?porPagina=100&somenteAtivos=true'),
    apiComSessao<Paginado<Cliente>>('/clientes?porPagina=100'),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Novo lançamento</h1>
        <p className="text-muted-foreground text-sm">
          Entrada ou saída. Vincular ao serviço é o que permite calcular a margem depois.
        </p>
      </header>

      <FormularioLancamento
        categorias={categorias}
        servicos={servicos.dados}
        clientes={clientes.dados}
      />
    </div>
  );
}
