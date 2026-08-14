import type { Metadata } from 'next';
import Link from 'next/link';
import type { Cliente, Paginado } from '@gestao/shared-types';
import { apiComSessao } from '@/lib/api-servidor';
import { FormularioLembrete } from '../formulario-lembrete';

export const metadata: Metadata = {
  title: 'Novo lembrete — Gestão Empresarial',
};

interface Props {
  searchParams: Promise<{ cliente?: string }>;
}

export default async function PaginaNovoLembrete({ searchParams }: Props) {
  const { cliente: clienteFixo } = await searchParams;
  const clientes = await apiComSessao<Paginado<Cliente>>('/clientes?porPagina=100');

  if (clientes.dados.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-16 text-center">
        <p className="font-medium">Cadastre um cliente primeiro</p>
        <p className="text-muted-foreground max-w-sm text-sm">Todo lembrete é de alguém.</p>
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
        <h1 className="text-2xl font-semibold tracking-tight">Novo lembrete</h1>
        <p className="text-muted-foreground text-sm">
          Agende um follow-up para retomar contato com o cliente no momento certo.
        </p>
      </header>

      <FormularioLembrete clientes={clientes.dados} clienteFixo={clienteFixo} />
    </div>
  );
}
