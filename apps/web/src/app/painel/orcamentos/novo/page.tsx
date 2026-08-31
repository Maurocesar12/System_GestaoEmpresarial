import type { Metadata } from 'next';
import Link from 'next/link';
import type { Cliente, Paginado, Servico } from '@gestao/shared-types';
import { apiComSessao } from '@/lib/api-servidor';
import { FormularioOrcamento } from '../formulario-orcamento';

export const metadata: Metadata = {
  title: 'Novo orçamento',
};

interface Props {
  searchParams: Promise<{ cliente?: string }>;
}

export default async function PaginaNovoOrcamento({ searchParams }: Props) {
  const { cliente: clienteFixo } = await searchParams;

  // Limite alto nos dois: são para preencher um `<select>`. Se uma empresa
  // passar disso, o campo vira uma busca com autocompletar — mas é cedo para
  // construir isso sem saber se acontece.
  const [clientes, servicos] = await Promise.all([
    apiComSessao<Paginado<Cliente>>('/clientes?porPagina=100'),
    apiComSessao<Paginado<Servico>>('/servicos?porPagina=100&somenteAtivos=true'),
  ]);

  if (clientes.dados.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-16 text-center">
        <p className="font-medium">Cadastre um cliente primeiro</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          Todo orçamento pertence a um cliente.
        </p>
        <Link
          href="/painel/clientes/novo"
          className="bg-primary text-primary-foreground hover:bg-primary/90 mt-2 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
        >
          Novo cliente
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Novo orçamento</h1>
        <p className="text-muted-foreground text-sm">
          O orçamento nasce em aberto. Você registra a resposta do cliente depois.
        </p>
      </header>

      <FormularioOrcamento
        clientes={clientes.dados}
        servicos={servicos.dados}
        clienteFixo={clienteFixo}
      />
    </div>
  );
}
