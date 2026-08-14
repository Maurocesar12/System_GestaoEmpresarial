import type { Metadata } from 'next';
import Link from 'next/link';
import {
  diasNaEtapa,
  formatarBRL,
  type Cliente,
  type Orcamento,
  type Paginado,
  type QuadroFunil,
  type ResumoOrcamentos,
} from '@gestao/shared-types';
import { apiComSessao } from '@/lib/api-servidor';

export const metadata: Metadata = {
  title: 'Painel — Gestão Empresarial',
};

/** Dias parado numa etapa a partir do qual a negociação merece atenção. */
const DIAS_PARA_ALERTA = 7;

/**
 * Painel inicial.
 *
 * Responde três perguntas, nesta ordem: quanto está em jogo, o que está parado,
 * e o que fazer agora. Um painel que só mostra totais é bonito e inútil — o que
 * muda o dia de quem abre o sistema é saber onde agir.
 */
export default async function PaginaPainel() {
  const [clientes, quadro, resumo, orcamentos] = await Promise.all([
    apiComSessao<Paginado<Cliente>>('/clientes?porPagina=1'),
    apiComSessao<QuadroFunil>('/funil'),
    apiComSessao<ResumoOrcamentos>('/orcamentos/resumo'),
    apiComSessao<Paginado<Orcamento>>('/orcamentos?status=aberto&porPagina=5'),
  ]);

  const noFunil = quadro.colunas.reduce((soma, coluna) => soma + coluna.clientes.length, 0);

  // Negociações que não se movem há mais de uma semana. É o número que revela
  // dinheiro esquecido — o resto do painel mostra o que já está em andamento.
  const paradas = quadro.colunas
    .flatMap((coluna) => coluna.clientes.map((cliente) => ({ cliente, etapa: coluna.etapa.nome })))
    .filter(({ cliente }) => diasNaEtapa(cliente.atualizadoEm) >= DIAS_PARA_ALERTA)
    .sort((a, b) => diasNaEtapa(a.cliente.atualizadoEm) - diasNaEtapa(b.cliente.atualizadoEm))
    .reverse()
    .slice(0, 5);

  const vazio = clientes.meta.total === 0;

  if (vazio) {
    return <PrimeirosPassos />;
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Painel</h1>
        <p className="text-muted-foreground text-sm">A situação do seu negócio agora.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          titulo="Em negociação"
          valor={formatarBRL(resumo.abertos.valor)}
          detalhe={`${resumo.abertos.quantidade} orçamento(s) em aberto`}
          href="/painel/orcamentos?status=aberto"
        />
        <Indicador
          titulo="Fechado"
          valor={formatarBRL(resumo.aprovados.valor)}
          detalhe={`${resumo.aprovados.quantidade} aprovado(s)`}
          href="/painel/orcamentos?status=aprovado"
        />
        <Indicador
          titulo="No funil"
          valor={String(noFunil)}
          detalhe={
            quadro.totalForaDoFunil > 0
              ? `${quadro.totalForaDoFunil} cliente(s) fora`
              : 'todos os clientes'
          }
          href="/painel/funil"
        />
        <Indicador
          titulo="Clientes"
          valor={String(clientes.meta.total)}
          detalhe="na carteira"
          href="/painel/clientes"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-sm font-medium">Paradas há mais de {DIAS_PARA_ALERTA} dias</h2>
            <Link
              href="/painel/funil"
              className="text-muted-foreground text-xs underline-offset-4 hover:underline"
            >
              ver funil
            </Link>
          </div>

          {paradas.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
              Nenhuma negociação parada. Bom sinal.
            </p>
          ) : (
            <ul className="flex flex-col rounded-lg border">
              {paradas.map(({ cliente, etapa }) => (
                <li
                  key={cliente.id}
                  className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0"
                >
                  <div className="flex flex-col">
                    <Link
                      href={`/painel/clientes/${cliente.id}`}
                      className="text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {cliente.nome}
                    </Link>
                    <span className="text-muted-foreground text-xs">{etapa}</span>
                  </div>

                  <span className="text-muted-foreground text-xs tabular-nums">
                    {diasNaEtapa(cliente.atualizadoEm)} dias
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-sm font-medium">Orçamentos aguardando resposta</h2>
            <Link
              href="/painel/orcamentos?status=aberto"
              className="text-muted-foreground text-xs underline-offset-4 hover:underline"
            >
              ver todos
            </Link>
          </div>

          {orcamentos.dados.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
              Nenhum orçamento em aberto.
            </p>
          ) : (
            <ul className="flex flex-col rounded-lg border">
              {orcamentos.dados.map((orcamento) => (
                <li
                  key={orcamento.id}
                  className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0"
                >
                  <Link
                    href={`/painel/orcamentos/${orcamento.id}`}
                    className="text-sm underline-offset-4 hover:underline"
                  >
                    {orcamento.clienteNome}
                  </Link>

                  <span className="text-sm font-medium tabular-nums">
                    {formatarBRL(orcamento.valor)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Indicador({
  titulo,
  valor,
  detalhe,
  href,
}: {
  titulo: string;
  valor: string;
  detalhe: string;
  href: string;
}) {
  return (
    <Link href={href} className="hover:bg-muted/30 rounded-lg border p-4 transition-colors">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
      <p className="text-muted-foreground text-xs">{detalhe}</p>
    </Link>
  );
}

/**
 * Tela de empresa recém-criada.
 *
 * Números zerados não ajudam quem acabou de entrar. Uma sequência clara do que
 * fazer primeiro transforma a tela vazia em ponto de partida.
 */
function PrimeirosPassos() {
  const passos = [
    {
      titulo: 'Cadastre seus serviços',
      descricao: 'Com o custo de cada um, para o sistema calcular sua margem depois.',
      href: '/painel/servicos/novo',
      rotulo: 'Novo serviço',
    },
    {
      titulo: 'Cadastre um cliente',
      descricao: 'Nome e telefone já bastam para começar.',
      href: '/painel/clientes/novo',
      rotulo: 'Novo cliente',
    },
    {
      titulo: 'Emita um orçamento',
      descricao: 'O cliente entra no funil sozinho quando você emite a proposta.',
      href: '/painel/orcamentos/novo',
      rotulo: 'Novo orçamento',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Bem-vindo</h1>
        <p className="text-muted-foreground text-sm">
          Sua empresa está criada e o funil já vem configurado. Três passos para começar:
        </p>
      </header>

      <ol className="flex flex-col gap-3">
        {passos.map((passo, indice) => (
          <li key={passo.href} className="flex items-start gap-4 rounded-lg border p-4">
            <span className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-medium tabular-nums">
              {indice + 1}
            </span>

            <div className="flex flex-1 flex-col gap-1">
              <p className="font-medium">{passo.titulo}</p>
              <p className="text-muted-foreground text-sm">{passo.descricao}</p>
            </div>

            <Link
              href={passo.href}
              className="hover:bg-accent inline-flex h-9 shrink-0 items-center rounded-md border px-3 text-sm font-medium transition-colors"
            >
              {passo.rotulo}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
