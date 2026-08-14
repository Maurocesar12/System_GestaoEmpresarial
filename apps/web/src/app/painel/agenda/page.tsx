import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ROTULO_STATUS_AGENDAMENTO,
  STATUS_AGENDAMENTO,
  estaAtrasado,
  formatarTelefone,
  type Agendamento,
  type Paginado,
} from '@gestao/shared-types';
import { apiComSessao } from '@/lib/api-servidor';
import { formatarDiaAgenda, formatarHora } from '@/lib/formatacao';
import { AcoesAgendamento } from './acoes-agendamento';

export const metadata: Metadata = {
  title: 'Agenda — Gestão Empresarial',
};

interface Props {
  searchParams: Promise<{ status?: string; de?: string; ate?: string; pagina?: string }>;
}

/**
 * Agenda de serviços.
 *
 * Agrupada por dia, e não em tabela corrida: quem abre esta tela quer saber o
 * que tem para hoje e para amanhã, não percorrer uma lista uniforme de
 * compromissos.
 */
export default async function PaginaAgenda({ searchParams }: Props) {
  const { status, de, ate, pagina = '1' } = await searchParams;

  const query = new URLSearchParams({ pagina, porPagina: '50' });
  if (status) query.set('status', status);
  if (de) query.set('de', de);
  if (ate) query.set('ate', ate);

  const agenda = await apiComSessao<Paginado<Agendamento>>(`/agendamentos?${query.toString()}`);

  const atrasados = agenda.dados.filter(estaAtrasado);
  const porDia = agruparPorDia(agenda.dados);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
          <p className="text-muted-foreground text-sm">
            {agenda.meta.total === 0
              ? 'Nenhum serviço agendado.'
              : `${agenda.meta.total} ${agenda.meta.total === 1 ? 'compromisso' : 'compromissos'}.`}
          </p>
        </div>

        <Link
          href="/painel/agenda/novo"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
        >
          Novo agendamento
        </Link>
      </header>

      {/* Compromissos vencidos sem desfecho vêm primeiro: são os que exigem uma
          decisão — foi feito? foi cancelado? — e some da agenda se ninguém age. */}
      {atrasados.length > 0 && (
        <section className="border-destructive/40 bg-destructive/5 flex flex-col gap-2 rounded-lg border p-4">
          <h2 className="text-destructive text-sm font-medium">
            {atrasados.length}{' '}
            {atrasados.length === 1 ? 'compromisso passou' : 'compromissos passaram'} da data
          </h2>
          <p className="text-muted-foreground text-sm">
            Marque como executado ou cancele para tirá-los da lista.
          </p>
        </section>
      )}

      <nav className="flex flex-wrap gap-2" aria-label="Filtrar por status">
        <Filtro atual={status} valor={undefined} rotulo="Todos" />
        {STATUS_AGENDAMENTO.map((valor) => (
          <Filtro
            key={valor}
            atual={status}
            valor={valor}
            rotulo={ROTULO_STATUS_AGENDAMENTO[valor]}
          />
        ))}
      </nav>

      {agenda.dados.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="font-medium">Agenda vazia</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            {status
              ? 'Nenhum compromisso com este status.'
              : 'Agende o primeiro serviço para acompanhar o que precisa ser feito.'}
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
                {itens.map((agendamento) => (
                  <li
                    key={agendamento.id}
                    className="flex flex-wrap items-start justify-between gap-4 border-b p-4 last:border-b-0"
                  >
                    <div className="flex min-w-0 flex-1 gap-4">
                      <span className="text-sm font-semibold tabular-nums">
                        {formatarHora(agendamento.dataHora)}
                      </span>

                      <div className="flex min-w-0 flex-col gap-0.5">
                        <Link
                          href={`/painel/agenda/${agendamento.id}`}
                          className="truncate text-sm font-medium underline-offset-4 hover:underline"
                        >
                          {agendamento.clienteNome}
                        </Link>

                        <span className="text-muted-foreground truncate text-xs">
                          {agendamento.servicoNome ?? 'Sem serviço do catálogo'}
                          {agendamento.clienteTelefone &&
                            ` · ${formatarTelefone(agendamento.clienteTelefone)}`}
                        </span>

                        <Selo agendamento={agendamento} />
                      </div>
                    </div>

                    <AcoesAgendamento id={agendamento.id} status={agendamento.status} />
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

function Selo({ agendamento }: { agendamento: Agendamento }) {
  const cores: Record<string, string> = {
    agendado: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    confirmado: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400',
    executado: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    cancelado: 'border-muted-foreground/30 bg-muted text-muted-foreground',
  };

  return (
    <span className="mt-1 flex flex-wrap items-center gap-2">
      {/* A cor nunca é o único sinal: o texto acompanha sempre. */}
      <span
        className={`w-fit rounded-full border px-2 py-0.5 text-xs font-medium ${cores[agendamento.status]}`}
      >
        {ROTULO_STATUS_AGENDAMENTO[agendamento.status]}
      </span>

      {estaAtrasado(agendamento) && (
        <span className="text-destructive text-xs font-medium">passou da data</span>
      )}
    </span>
  );
}

function Filtro({ atual, valor, rotulo }: { atual?: string; valor?: string; rotulo: string }) {
  const ativo = atual === valor;
  const href = valor ? `/painel/agenda?status=${valor}` : '/painel/agenda';

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

/** Agrupa mantendo a ordem cronológica que a API já devolveu. */
function agruparPorDia(agendamentos: Agendamento[]): { dia: string; itens: Agendamento[] }[] {
  const grupos = new Map<string, Agendamento[]>();

  for (const agendamento of agendamentos) {
    const dia = agendamento.dataHora.slice(0, 10);
    grupos.set(dia, [...(grupos.get(dia) ?? []), agendamento]);
  }

  return [...grupos.entries()].map(([dia, itens]) => ({ dia, itens }));
}
