import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ROTULO_STATUS,
  formatarBRL,
  type Cliente,
  type Orcamento,
  type Paginado,
  type Servico,
} from '@gestao/shared-types';
import { apiComSessao } from '@/lib/api-servidor';
import { formatarDataCompleta } from '@/lib/formatacao';
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

  const [orcamento, clientes, servicos] = await Promise.all([
    apiComSessao<Orcamento>(`/orcamentos/${id}`),
    apiComSessao<Paginado<Cliente>>('/clientes?porPagina=100'),
    apiComSessao<Paginado<Servico>>('/servicos?porPagina=100&somenteAtivos=true'),
  ]);

  const editavel = orcamento.status === 'aberto';

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
        <AcoesStatus id={orcamento.id} status={orcamento.status} />
      </section>

      {editavel ? (
        <FormularioOrcamento
          orcamento={orcamento}
          clientes={clientes.dados}
          servicos={servicos.dados}
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
