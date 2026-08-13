import type { Metadata } from 'next';
import { FormularioCliente } from '../formulario-cliente';

export const metadata: Metadata = {
  title: 'Novo cliente — Gestão Empresarial',
};

export default function PaginaNovoCliente() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Novo cliente</h1>
        <p className="text-muted-foreground text-sm">
          Só o nome é obrigatório. O resto pode ser preenchido depois.
        </p>
      </header>

      <FormularioCliente />
    </div>
  );
}
