import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Importador } from './importador';

export const metadata: Metadata = {
  title: 'Importar clientes',
};

/**
 * Importação de clientes por planilha.
 *
 * A página é de servidor e praticamente não faz nada: o trabalho todo acontece
 * no navegador, que lê o arquivo, valida e envia em lotes. Não há dado da
 * empresa para buscar aqui — a lista de clientes existentes não é necessária,
 * porque quem detecta repetidos é a API, com uma consulta só.
 */
export default function PaginaImportarClientes() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link
          href="/painel/clientes"
          className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Voltar para clientes
        </Link>

        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Importar clientes</h1>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Suba a planilha que você já tem. Nada é gravado antes de você conferir o que será
            importado.
          </p>
        </div>
      </header>

      <Importador />
    </div>
  );
}
