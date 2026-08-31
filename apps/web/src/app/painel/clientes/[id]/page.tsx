import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ROTULO_CANAL_LEMBRETE,
  ROTULO_STATUS,
  formatarBRL,
  type Atendimento,
  type Cliente,
  type EtapaFunil,
  type LembreteFollowUp,
  type Orcamento,
  type Paginado,
} from '@gestao/shared-types';
import { apiComSessao } from '@/lib/api-servidor';
import {
  formatarDataCompleta,
  formatarDataLonga,
  formatarDiaAgenda,
  formatarHora,
} from '@/lib/formatacao';
import { FormularioCliente } from '../formulario-cliente';
import { Atendimentos } from './atendimentos';
import { BotaoRemover } from './botao-remover';
import { EntrarNoFunil } from './entrar-no-funil';

export const metadata: Metadata = {
  title: 'Cliente',
};

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * Ficha do cliente.
 *
 * É a tela que junta os setores: cadastro, posição no funil, orçamentos e
 * histórico de atendimento, tudo do mesmo cliente, em um lugar só.
 *
 * As consultas rodam em paralelo: em sequência, a página esperaria a soma dos
 * tempos em vez do mais lento deles.
 */
export default async function PaginaCliente({ params }: Props) {
  const { id } = await params;

  const [cliente, etapas, orcamentos, atendimentos, lembretes] = await Promise.all([
    apiComSessao<Cliente>(`/clientes/${id}`),
    apiComSessao<EtapaFunil[]>('/funil/etapas'),
    apiComSessao<Paginado<Orcamento>>(`/orcamentos?clienteId=${id}&porPagina=50`),
    apiComSessao<Atendimento[]>(`/clientes/${id}/atendimentos`),
    apiComSessao<Paginado<LembreteFollowUp>>(
      `/lembretes?clienteId=${id}&status=pendente&porPagina=5`,
    ),
  ]);

  const etapaAtual = cliente.etapaFunil?.id ?? null;

  const totalAprovado = orcamentos.dados
    .filter((orcamento) => orcamento.status === 'aprovado')
    .reduce((soma, orcamento) => soma + Number(orcamento.valor), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Link
          href="/painel/clientes"
          className="text-muted-foreground hover:text-foreground w-fit text-sm underline-offset-4 hover:underline"
        >
          ← Clientes
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight">{cliente.nome}</h1>

        <p className="text-muted-foreground text-sm">
          Cliente desde {formatarDataLonga(cliente.criadoEm)}.
        </p>
      </div>

      {/* Resumo antes do formulário: quem abre a ficha quase sempre quer saber
          a situação do cliente, não editar o cadastro. */}
      <section className="grid gap-3 sm:grid-cols-4">
        <Indicador
          titulo="Fechado com este cliente"
          valor={formatarBRL(totalAprovado.toFixed(2))}
        />
        <Indicador
          titulo="Orçamentos"
          valor={String(orcamentos.meta.total)}
          detalhe={`${orcamentos.dados.filter((o) => o.status === 'aberto').length} em aberto`}
        />
        <Indicador
          titulo="Atendimentos"
          valor={String(atendimentos.length)}
          detalhe={
            atendimentos[0] ? `último em ${formatarDataCompleta(atendimentos[0].data)}` : undefined
          }
        />
        <Indicador
          titulo="Lembretes"
          valor={String(lembretes.meta.total)}
          detalhe={lembretes.dados[0] ? `próximo ${formatarQuando(lembretes.dados[0])}` : undefined}
        />
      </section>

      <EntrarNoFunil clienteId={cliente.id} etapas={etapas} etapaAtual={etapaAtual} />

      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium">Lembretes pendentes</h2>
          <Link
            href={`/painel/lembretes/novo?cliente=${cliente.id}`}
            className="text-sm underline underline-offset-4"
          >
            Novo lembrete
          </Link>
        </div>

        {lembretes.dados.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum follow-up pendente.</p>
        ) : (
          <ul className="flex flex-col">
            {lembretes.dados.map((lembrete) => (
              <li
                key={lembrete.id}
                className="flex items-center justify-between gap-4 border-t py-2 first:border-t-0"
              >
                <span className="text-sm">{formatarQuando(lembrete)}</span>
                <span className="text-muted-foreground text-xs">
                  {ROTULO_CANAL_LEMBRETE[lembrete.canal]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium">Orçamentos</h2>
          <Link
            href={`/painel/orcamentos/novo?cliente=${cliente.id}`}
            className="text-sm underline underline-offset-4"
          >
            Novo orçamento
          </Link>
        </div>

        {orcamentos.dados.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum orçamento para este cliente.</p>
        ) : (
          <ul className="flex flex-col">
            {orcamentos.dados.map((orcamento) => (
              <li
                key={orcamento.id}
                className="flex items-center justify-between gap-4 border-t py-2 first:border-t-0"
              >
                <Link
                  href={`/painel/orcamentos/${orcamento.id}`}
                  className="text-sm underline-offset-4 hover:underline"
                >
                  {orcamento.servicoNome ?? 'Sem serviço do catálogo'}
                </Link>

                <span className="flex items-center gap-3">
                  <span className="text-muted-foreground text-xs">
                    {ROTULO_STATUS[orcamento.status]}
                  </span>
                  <span className="text-sm font-medium tabular-nums">
                    {formatarBRL(orcamento.valor)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Atendimentos clienteId={cliente.id} atendimentos={atendimentos} />

      <details className="rounded-lg border p-4">
        {/* O cadastro fica recolhido: editar dados é a ação menos frequente
            aqui, e ocupava a maior parte da tela. */}
        <summary className="cursor-pointer text-sm font-medium">Editar cadastro</summary>
        <div className="pt-4">
          <FormularioCliente cliente={cliente} />
        </div>
      </details>

      <section className="border-destructive/30 flex flex-col gap-3 rounded-lg border border-dashed p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">Excluir cliente</h2>
          <p className="text-muted-foreground text-sm">
            Apaga também o histórico de atendimentos, orçamentos e agendamentos deste cliente. Não
            há como desfazer.
          </p>
        </div>

        <BotaoRemover id={cliente.id} nome={cliente.nome} />
      </section>
    </div>
  );
}

function formatarQuando(lembrete: LembreteFollowUp): string {
  return `${formatarDiaAgenda(lembrete.dataEnvio.slice(0, 10)).toLowerCase()} às ${formatarHora(
    lembrete.dataEnvio,
  )}`;
}

function Indicador({
  titulo,
  valor,
  detalhe,
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{titulo}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{valor}</p>
      {detalhe && <p className="text-muted-foreground text-xs">{detalhe}</p>}
    </div>
  );
}
