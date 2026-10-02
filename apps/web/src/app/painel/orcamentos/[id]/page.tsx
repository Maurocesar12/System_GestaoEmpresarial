import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarPlus } from 'lucide-react';
import {
  ROTULO_STATUS,
  ROTULO_STATUS_AGENDAMENTO,
  formatarBRL,
  formatarDataHora,
  type Agendamento,
  type Cliente,
  type Orcamento,
  type Paginado,
  type PessoaEquipe,
  type Servico,
} from '@gestao/shared-types';
import { estilosBotao } from '@/components/ui/botao';
import { apiComSessao, usuarioAtual } from '@/lib/api-servidor';
import { formatarDataCompleta } from '@/lib/formatacao';
import { pode } from '@/lib/permissoes';
import { AcoesStatus } from '../acoes-status';
import { FormularioOrcamento } from '../formulario-orcamento';

export const metadata: Metadata = {
  title: 'Orçamento',
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PaginaOrcamento({ params }: Props) {
  const { id } = await params;

  const [orcamento, clientes, servicos, pessoas, usuario] = await Promise.all([
    apiComSessao<Orcamento>(`/orcamentos/${id}`),
    apiComSessao<Paginado<Cliente>>('/clientes?porPagina=100'),
    apiComSessao<Paginado<Servico>>('/servicos?porPagina=100&somenteAtivos=true'),
    apiComSessao<PessoaEquipe[]>('/equipe/pessoas'),
    usuarioAtual(),
  ]);

  const editavel = orcamento.editavel;

  // Orçamento aprovado tem um próximo passo óbvio: marcar o serviço. Se já
  // existe um agendamento ligado a ele (e não cancelado), o atalho leva até
  // esse agendamento em vez de oferecer criar um segundo.
  const ofereceAgendar = orcamento.status === 'aprovado' && pode(usuario, 'agenda.gerenciar');

  const agendamentoExistente = ofereceAgendar
    ? (
        await apiComSessao<Paginado<Agendamento>>(
          `/agendamentos?clienteId=${orcamento.clienteId}&porPagina=100`,
        )
      ).dados.find(
        (agendamento) =>
          agendamento.orcamentoId === orcamento.id && agendamento.status !== 'cancelado',
      )
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Link
          href="/painel/orcamentos"
          className="text-muted-foreground hover:text-foreground w-fit text-sm underline-offset-4 hover:underline"
        >
          ← Orçamentos
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight">{formatarBRL(orcamento.valor)}</h1>

        <p className="text-muted-foreground text-sm">
          {orcamento.clienteNome} · {ROTULO_STATUS[orcamento.status]}
        </p>
      </div>

      <section className="flex flex-wrap items-center gap-3 rounded-lg border p-4">
        <span className="text-sm font-medium">Resposta do cliente:</span>
        <AcoesStatus id={orcamento.id} acoes={orcamento.acoesDisponiveis} />
      </section>

      {ofereceAgendar && (
        <section className="border-sucesso/40 bg-sucesso-suave flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
          {agendamentoExistente ? (
            <>
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">Serviço já agendado</p>
                <p className="text-muted-foreground text-sm">
                  {formatarDataHora(agendamentoExistente.dataHora)} ·{' '}
                  {ROTULO_STATUS_AGENDAMENTO[agendamentoExistente.status]}
                </p>
              </div>
              <Link
                href={`/painel/agenda/${agendamentoExistente.id}`}
                className={estilosBotao({ variante: 'secundario' })}
              >
                Ver agendamento
              </Link>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">Próximo passo: agendar o serviço</p>
                <p className="text-muted-foreground text-sm">
                  Cliente, serviço e valor já vão preenchidos. É só escolher o dia.
                </p>
              </div>
              <Link
                href={`/painel/agenda/novo?orcamento=${orcamento.id}`}
                className={estilosBotao()}
              >
                <CalendarPlus aria-hidden />
                Agendar serviço
              </Link>
            </>
          )}
        </section>
      )}

      {editavel ? (
        <FormularioOrcamento
          orcamento={orcamento}
          clientes={clientes.dados}
          servicos={servicos.dados}
          pessoas={pessoas}
        />
      ) : (
        // Orçamento respondido vira registro histórico: alterar o valor de algo
        // já aprovado mudaria um compromisso fechado — e, adiante, a receita que
        // ele gerou.
        <section className="flex flex-col gap-3 rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">
            Este orçamento está {ROTULO_STATUS[orcamento.status].toLowerCase()} e não pode mais ser
            alterado. Para mudar o combinado, emita um novo.
          </p>

          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Serviço</dt>
            <dd>{orcamento.servicoNome ?? '—'}</dd>

            <dt className="text-muted-foreground">Vendedor</dt>
            <dd>{orcamento.vendedorNome ?? '—'}</dd>

            <dt className="text-muted-foreground">Descrição</dt>
            <dd className="whitespace-pre-wrap">{orcamento.descricao ?? '—'}</dd>

            <dt className="text-muted-foreground">Respondido em</dt>
            <dd>{orcamento.respondidoEm ? formatarDataCompleta(orcamento.respondidoEm) : '—'}</dd>
          </dl>

          <Link
            href={`/painel/orcamentos/novo?cliente=${orcamento.clienteId}`}
            className="hover:bg-accent inline-flex h-10 w-fit items-center justify-center rounded-md border px-4 text-sm font-medium transition-colors"
          >
            Emitir novo para este cliente
          </Link>
        </section>
      )}
    </div>
  );
}
