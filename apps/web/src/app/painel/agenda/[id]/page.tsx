import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ROTULO_STATUS_AGENDAMENTO,
  estaPendente,
  formatarDataHora,
  type Agendamento,
  type Cliente,
  type Paginado,
  type Servico,
} from '@gestao/shared-types';
import { apiComSessao } from '@/lib/api-servidor';
import { AcoesAgendamento } from '../acoes-agendamento';
import { FormularioAgendamento } from '../formulario-agendamento';

export const metadata: Metadata = {
  title: 'Agendamento',
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PaginaAgendamento({ params }: Props) {
  const { id } = await params;

  const [agendamento, clientes, servicos] = await Promise.all([
    apiComSessao<Agendamento>(`/agendamentos/${id}`),
    apiComSessao<Paginado<Cliente>>('/clientes?porPagina=100'),
    apiComSessao<Paginado<Servico>>('/servicos?porPagina=100&somenteAtivos=true'),
  ]);

  const editavel = estaPendente(agendamento);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Link
          href="/painel/agenda"
          className="text-muted-foreground hover:text-foreground w-fit text-sm underline-offset-4 hover:underline"
        >
          ← Agenda
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight">
          {formatarDataHora(agendamento.dataHora)}
        </h1>

        <p className="text-muted-foreground text-sm">
          <Link
            href={`/painel/clientes/${agendamento.clienteId}`}
            className="underline underline-offset-4"
          >
            {agendamento.clienteNome}
          </Link>{' '}
          · {ROTULO_STATUS_AGENDAMENTO[agendamento.status]}
        </p>
      </div>

      <section className="flex flex-wrap items-center gap-3 rounded-lg border p-4">
        <span className="text-sm font-medium">Situação:</span>
        <AcoesAgendamento id={agendamento.id} status={agendamento.status} />
      </section>

      {editavel ? (
        <FormularioAgendamento
          agendamento={agendamento}
          clientes={clientes.dados}
          servicos={servicos.dados}
        />
      ) : (
        // Compromisso encerrado vira registro histórico: mudar a data de algo
        // já executado reescreveria o passado.
        <section className="flex flex-col gap-3 rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">
            Este agendamento está {ROTULO_STATUS_AGENDAMENTO[agendamento.status].toLowerCase()} e
            não pode mais ser alterado.
            {agendamento.status === 'executado' &&
              ' O atendimento já foi registrado no histórico do cliente.'}
          </p>

          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Serviço</dt>
            <dd>{agendamento.servicoNome ?? '—'}</dd>

            <dt className="text-muted-foreground">Observações</dt>
            <dd className="whitespace-pre-wrap">{agendamento.observacoes ?? '—'}</dd>
          </dl>

          <Link
            href={`/painel/agenda/novo?cliente=${agendamento.clienteId}`}
            className="hover:bg-accent inline-flex h-10 w-fit items-center justify-center rounded-md border px-4 text-sm font-medium transition-colors"
          >
            Agendar outro para este cliente
          </Link>
        </section>
      )}
    </div>
  );
}
