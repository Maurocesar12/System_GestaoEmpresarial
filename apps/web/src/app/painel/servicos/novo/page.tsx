import type { Metadata } from 'next';
import { FormularioServico } from '../formulario-servico';

export const metadata: Metadata = {
  title: 'Novo serviço',
};

export default function PaginaNovoServico() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Novo serviço</h1>
        <p className="text-muted-foreground text-sm">
          O custo é o que você gasta para executar. É dele que sai a margem.
        </p>
      </header>

      <FormularioServico />
    </div>
  );
}
