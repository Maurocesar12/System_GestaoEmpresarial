import type { Metadata } from 'next';
import Link from 'next/link';
import {
  formatarDocumento,
  formatarTelefone,
  type Cliente,
  type Paginado,
} from '@gestao/shared-types';
import { apiComSessao } from '@/lib/api-servidor';
import { CampoBusca } from './campo-busca';

export const metadata: Metadata = {
  title: 'Clientes — Gestão Empresarial',
};

interface Props {
  searchParams: Promise<{ busca?: string; pagina?: string }>;
}

/**
 * Listagem de clientes.
 *
 * Componente de servidor: a busca acontece na API e a página chega pronta ao
 * navegador. A alternativa — carregar tudo e filtrar no cliente — pararia de
 * funcionar assim que uma empresa passasse de algumas centenas de clientes.
 *
 * Os filtros vivem na URL (`?busca=maria&pagina=2`), e não em estado do React.
 * Assim a busca é compartilhável por link, sobrevive ao recarregar a página e
 * funciona com o botão voltar do navegador.
 */
export default async function PaginaClientes({ searchParams }: Props) {
  const { busca = '', pagina = '1' } = await searchParams;

  const query = new URLSearchParams({ pagina, porPagina: '20' });
  if (busca) query.set('busca', busca);

  const { dados: clientes, meta } = await apiComSessao<Paginado<Cliente>>(
    `/clientes?${query.toString()}`,
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground text-sm">
            {meta.total === 0
              ? 'Nenhum cliente cadastrado ainda.'
              : `${meta.total} ${meta.total === 1 ? 'cliente cadastrado' : 'clientes cadastrados'}.`}
          </p>
        </div>

        <Link
          href="/painel/clientes/novo"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
        >
          Novo cliente
        </Link>
      </header>

      <CampoBusca valorInicial={busca} />

      {clientes.length === 0 ? (
        <EstadoVazio temBusca={Boolean(busca)} />
      ) : (
        <>
          {/* A tabela rola na horizontal em telas estreitas, em vez de fazer a
              página inteira rolar de lado. */}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Contato</th>
                  <th className="px-4 py-3 font-medium">Documento</th>
                  <th className="px-4 py-3 font-medium">Origem</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-muted/30 border-t transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/painel/clientes/${cliente.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {cliente.nome}
                      </Link>
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      <div className="flex flex-col">
                        {cliente.telefone && <span>{formatarTelefone(cliente.telefone)}</span>}
                        {cliente.email && <span className="text-xs">{cliente.email}</span>}
                        {!cliente.telefone && !cliente.email && <span>—</span>}
                      </div>
                    </td>
                    <td className="text-muted-foreground px-4 py-3 tabular-nums">
                      {formatarDocumento(cliente.documento) || '—'}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">{cliente.origem ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta.totalPaginas > 1 && (
            <Paginacao pagina={meta.pagina} totalPaginas={meta.totalPaginas} busca={busca} />
          )}
        </>
      )}
    </div>
  );
}

function EstadoVazio({ temBusca }: { temBusca: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-16 text-center">
      <p className="font-medium">
        {temBusca ? 'Nenhum cliente encontrado' : 'Sua carteira está vazia'}
      </p>
      <p className="text-muted-foreground max-w-sm text-sm">
        {temBusca
          ? 'Tente outro termo, ou verifique se o cliente foi cadastrado com outro nome.'
          : 'Cadastre o primeiro cliente para começar a registrar atendimentos e orçamentos.'}
      </p>
    </div>
  );
}

function Paginacao({
  pagina,
  totalPaginas,
  busca,
}: {
  pagina: number;
  totalPaginas: number;
  busca: string;
}) {
  const link = (destino: number) => {
    const query = new URLSearchParams({ pagina: String(destino) });
    if (busca) query.set('busca', busca);
    return `/painel/clientes?${query.toString()}`;
  };

  return (
    <nav className="flex items-center justify-between gap-4" aria-label="Paginação">
      <span className="text-muted-foreground text-sm">
        Página {pagina} de {totalPaginas}
      </span>

      <div className="flex gap-2">
        {pagina > 1 && (
          <Link
            href={link(pagina - 1)}
            className="hover:bg-accent inline-flex h-9 items-center rounded-md border px-3 text-sm transition-colors"
          >
            Anterior
          </Link>
        )}
        {pagina < totalPaginas && (
          <Link
            href={link(pagina + 1)}
            className="hover:bg-accent inline-flex h-9 items-center rounded-md border px-3 text-sm transition-colors"
          >
            Próxima
          </Link>
        )}
      </div>
    </nav>
  );
}
