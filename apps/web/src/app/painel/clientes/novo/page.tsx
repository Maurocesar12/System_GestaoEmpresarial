import type { Metadata } from 'next';
import { FormularioCliente } from '../formulario-cliente';
import type { ConfiguracoesEmpresa } from '@gestao/shared-types';
import { apiComSessao } from '@/lib/api-servidor';

export const metadata: Metadata = {
  title: 'Novo cliente',
};

export default async function PaginaNovoCliente() {
  const configuracoes = await apiComSessao<ConfiguracoesEmpresa>('/configuracoes');
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Novo cliente</h1>
        <p className="text-muted-foreground text-sm">
          Só o nome é obrigatório. O resto pode ser preenchido depois.
        </p>
      </header>

      <FormularioCliente campos={configuracoes.campos} etiquetas={configuracoes.etiquetas} />
    </div>
  );
}
