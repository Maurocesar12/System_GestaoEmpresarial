import type { Metadata } from 'next';
import Link from 'next/link';
import { FormularioLogin } from './formulario-login';

export const metadata: Metadata = {
  title: 'Entrar — Gestão Empresarial',
};

export default function PaginaEntrar() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
        <p className="text-muted-foreground text-sm">Acesse o painel da sua empresa.</p>
      </header>

      <FormularioLogin />

      <p className="text-muted-foreground text-center text-sm">
        Ainda não tem conta?{' '}
        <Link href="/cadastro" className="text-foreground font-medium underline underline-offset-4">
          Cadastre sua empresa
        </Link>
      </p>
    </div>
  );
}
