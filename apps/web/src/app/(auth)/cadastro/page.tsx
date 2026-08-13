import type { Metadata } from 'next';
import Link from 'next/link';
import { FormularioCadastro } from './formulario-cadastro';

export const metadata: Metadata = {
  title: 'Cadastrar empresa — Gestão Empresarial',
};

export default function PaginaCadastro() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Cadastre sua empresa</h1>
        <p className="text-muted-foreground text-sm">
          Leva menos de um minuto. Você entra direto no painel.
        </p>
      </header>

      <FormularioCadastro />

      <p className="text-muted-foreground text-center text-sm">
        Já tem conta?{' '}
        <Link href="/entrar" className="text-foreground font-medium underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </div>
  );
}
