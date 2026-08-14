import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ROTULO_CANAL_LEMBRETE,
  ROTULO_STATUS_LEMBRETE,
  STATUS_LEMBRETE,
  formatarTelefone,
  type LembreteFollowUp,
  type Paginado,
} from '@gestao/shared-types';
import { apiComSessao } from '@/lib/api-servidor';
import { formatarDiaAgenda, formatarHora } from '@/lib/formatacao';
import { AcoesLembrete } from './acoes-lembrete';

export const metadata: Metadata = {
  title: 'Lembretes — Gestão Empresarial',
};

interface Props {
  searchParams: Promise<{ status?: string; pagina?: string }>;
}

export default async function PaginaLembretes({ searchParams }: Props) {
  const { status, pagina = '1' } = await searchParams;

  const query = new URLSearchParams({ pagina, porPagina: '50' });
  if (status) query.set('status', status);

  const lembretes = await apiComSessao<Paginado<LembreteFollowUp>>(
    `/lembretes?${query.toString()}`,
  );
  const porDia = agruparPorDia(lembretes.dados);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Lembretes</h1>
          <p className="text-muted-foreground text-sm">
            {lembretes.meta.total === 0
              ? 'Nenhum follow-up agendado.'
              : `${lembretes.meta.total} ${
                  lembretes.meta.total === 1 ? 'follow-up' : 'follow-ups'
                }.`}
          </p>
        </div>

        <Link
          href="/painel/lembretes/novo"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
        >
          Novo lembrete
        </Link>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Filtrar por status">
        <Filtro atual={status} valor={undefined} rotulo="Todos" />
        {STATUS_LEMBRETE.map((valor) => (
          <Filtro key={valor} atual={status} valor={valor} rotulo={ROTULO_STATUS_LEMBRETE[valor]} />
        ))}
      </nav>

      {lembretes.dados.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="font-medium">Sem lembretes</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            Crie follow-ups para não deixar retorno importante escapar.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {porDia.map(({ dia, itens }) => (
            <section key={dia} className="flex flex-col gap-2">
              <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {formatarDiaAgenda(dia)}
              </h2>

              <ul className="flex flex-col rounded-lg border">
                {itens.map((lembrete) => (
                  <li
                    key={lembrete.id}
                    className="flex flex-wrap items-start justify-between gap-4 border-b p-4 last:border-b-0"
                  >
                    <div className="flex min-w-0 flex-1 gap-4">
                      <span className="text-sm font-semibold tabular-nums">
                        {formatarHora(lembrete.dataEnvio)}
                      </span>

                      <div className="flex min-w-0 flex-col gap-0.5">
                        <Link
                          href={`/painel/clientes/${lembrete.clienteId}`}
                          className="truncate text-sm font-medium underline-offset-4 hover:underline"
                        >
                          {lembrete.clienteNome}
                        </Link>

                        <span className="text-muted-foreground truncate text-xs">
                          {ROTULO_CANAL_LEMBRETE[lembrete.canal]}
                          {contatoDoCliente(lembrete) && ` · ${contatoDoCliente(lembrete)}`}
                        </span>

                        <Selo status={lembrete.status} />
                      </div>
                    </div>

                    <AcoesLembrete id={lembrete.id} status={lembrete.status} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Selo({ status }: { status: LembreteFollowUp['status'] }) {
  const cores: Record<LembreteFollowUp['status'], string> = {
    pendente: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    enviado: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    falhou: 'border-destructive/40 bg-destructive/10 text-destructive',
    cancelado: 'border-muted-foreground/30 bg-muted text-muted-foreground',
  };

  return (
    <span
      className={`mt-1 w-fit rounded-full border px-2 py-0.5 text-xs font-medium ${cores[status]}`}
    >
      {ROTULO_STATUS_LEMBRETE[status]}
    </span>
  );
}

function Filtro({ atual, valor, rotulo }: { atual?: string; valor?: string; rotulo: string }) {
  const ativo = atual === valor;
  const href = valor ? `/painel/lembretes?status=${valor}` : '/painel/lembretes';

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

function agruparPorDia(
  lembretes: LembreteFollowUp[],
): { dia: string; itens: LembreteFollowUp[] }[] {
  const grupos = new Map<string, LembreteFollowUp[]>();

  for (const lembrete of lembretes) {
    const dia = lembrete.dataEnvio.slice(0, 10);
    grupos.set(dia, [...(grupos.get(dia) ?? []), lembrete]);
  }

  return [...grupos.entries()].map(([dia, itens]) => ({ dia, itens }));
}

function contatoDoCliente(lembrete: LembreteFollowUp): string | null {
  if (lembrete.canal === 'email') return lembrete.clienteEmail;
  return lembrete.clienteTelefone ? formatarTelefone(lembrete.clienteTelefone) : null;
}
