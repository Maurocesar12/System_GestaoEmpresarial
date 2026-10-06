import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { lerDesafio } from '@/lib/sessao';
import { FormularioVerificacao } from './formulario-verificacao';

export const metadata: Metadata = {
  title: 'Código do celular',
};

export default async function PaginaVerificacao() {
  // Sem desafio, não há o que verificar: a senha precisa vir antes.
  if (!(await lerDesafio())) redirect('/entrar');

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Digite o código do celular</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Abra o app autenticador (por exemplo, o Google Authenticator) e procure{' '}
          <strong className="text-foreground">Gestão Empresarial</strong>. Digite os 6 números que
          aparecem ali.
        </p>
      </header>

      <FormularioVerificacao />
    </div>
  );
}
