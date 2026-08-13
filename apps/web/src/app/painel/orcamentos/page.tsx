import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ROTULO_STATUS,
  STATUS_ORCAMENTO,
  estaVencido,
  formatarBRL,
  type Orcamento,
  type Paginado,
  type ResumoOrcamentos,
} from '@gestao/shared-types';
import { apiComSessao } from '@/lib/api-servidor';
import { AcoesStatus } from './acoes-status';

export const metadata: Metadata = {
  title: 'Orçamentos — Gestão Empresarial',
};

interface Props {
  searchParams: Promise<{ status?: string; pagina?: string }>;
}

export default async function PaginaOrcamentos({ searchParams }: Props) {
  const { status, pagina = '1' } = await searchParams;

  const query = new URLSearchParams({ pagina, porPagina: '20' });
  if (status) query.set('status', status);

  const [lista, resumo] = await Promise.all([
    apiComSessao<Paginado<Orcamento>>(`/orcamentos?${query.toString()}`),
    apiComSessao<ResumoOrcamentos>('/orcamentos/resumo'),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Orçamentos</h1>
          <p className="text-muted-foreground text-sm">
            Propostas enviadas e o que já foi respondido.
          </p>
        </div>

        <Link
          href="/painel/orcamentos/novo"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
        >
          Novo orçamento
        </Link>
      </header>

      {/* O resumo vem primeiro porque responde a pergunta mais frequente:
          quanto está em negociação e quanto já foi fechado. */}
      <section className="grid gap-3 sm:grid-cols-3">
        <Cartao titulo="Em aberto" dados={resumo.abertos} destaque />
        <Cartao titulo="Aprovados" dados={resumo.aprovados} />
        <Cartao titulo="Recusados" dados={resumo.recusados} />
      </section>

      <nav className="flex flex-wrap gap-2" aria-label="Filtrar por status">
        <FiltroStatus atual={status} valor={undefined} rotulo="Todos" />
        {STATUS_ORCAMENTO.map((valor) => (
          <FiltroStatus key={valor} atual={status} valor={valor} rotulo={ROTULO_STATUS[valor]} />
        ))}
      </nav>

      {lista.dados.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="font-medium">Nenhum orçamento por aqui</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            {status
              ? 'Nenhum orçamento com este status.'
              : 'Emita o primeiro orçamento para acompanhar o que está em negociação.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Serviço</th>
                <th className="px-4 py-3 text-right font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.dados.map((orcamento) => (
                <tr key={orcamento.id} className="hover:bg-muted/30 border-t transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/painel/orcamentos/${orcamento.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {orcamento.clienteNome}
                    </Link>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {orcamento.servicoNome ?? '—'}
                  </td>
                  {/* `tabular-nums` alinha os dígitos em coluna, o que torna a
                      comparação de valores possível de bater o olho. */}
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatarBRL(orcamento.valor)}
                  </td>
                  <td className="px-4 py-3">
                    <Selo orcamento={orcamento} />
                  </td>
                  <td className="px-4 py-3">
                    <AcoesStatus id={orcamento.id} status={orcamento.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Cartao({
  titulo,
  dados,
  destaque = false,
}: {
  titulo: string;
  dados: { quantidade: number; valor: string };
  destaque?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${destaque ? 'bg-muted/30' : ''}`}>
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{formatarBRL(dados.valor)}</p>
      <p className="text-muted-foreground text-xs">
        {dados.quantidade} {dados.quantidade === 1 ? 'orçamento' : 'orçamentos'}
      </p>
    </div>
  );
}

/**
 * Selo de status.
 *
 * A cor não é o único sinal: o texto sempre acompanha. Quem não distingue
 * verde de vermelho continua lendo "Aprovado" e "Recusado".
 */
function Selo({ orcamento }: { orcamento: Orcamento }) {
  const vencido = estaVencido(orcamento);

  const cores: Record<string, string> = {
    aberto: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    aprovado: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    recusado: 'border-destructive/40 bg-destructive/10 text-destructive',
  };

  return (
    <span className="flex flex-col gap-1">
      <span
        className={`w-fit rounded-full border px-2 py-0.5 text-xs font-medium ${cores[orcamento.status]}`}
      >
        {ROTULO_STATUS[orcamento.status]}
      </span>
      {vencido && <span className="text-muted-foreground text-xs">validade expirada</span>}
    </span>
  );
}

function FiltroStatus({
  atual,
  valor,
  rotulo,
}: {
  atual?: string;
  valor?: string;
  rotulo: string;
}) {
  const ativo = atual === valor;
  const href = valor ? `/painel/orcamentos?status=${valor}` : '/painel/orcamentos';

  return (
    <Link
      href={href}
      aria-current={ativo ? 'page' : undefined}
      className={`inline-flex h-9 items-center rounded-md border px-3 text-sm transition-colors ${
        ativo ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
      }`}
    >
      {rotulo}
    </Link>
  );
}
