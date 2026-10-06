import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { lerDesafio } from '@/lib/sessao';
import { FormularioVerificacao } from './formulario-verificacao';

export const metadata: Metadata = {
  title: 'Verificação em duas etapas',
};

export default async function PaginaVerificacao() {
  // Sem desafio, não há o que verificar: a senha precisa vir antes.
  if (!(await lerDesafio())) redirect('/entrar');

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Verificação em duas etapas</h1>
        <p className="text-muted-foreground text-sm">
          Abra o app autenticador no celular e digite o código de 6 dígitos.
        </p>
      </header>

      <FormularioVerificacao />
    </div>
  );
}
