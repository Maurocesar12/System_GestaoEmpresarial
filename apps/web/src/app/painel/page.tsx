import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarClock, BellRing, Hourglass, FileText } from 'lucide-react';
import {
  ROTULO_CANAL_LEMBRETE,
  ROTULO_STATUS_AGENDAMENTO,
  DIAS_PARA_ALERTA,
  diasNaEtapa,
  formatarBRL,
  type Agendamento,
  type Cliente,
  type LembreteFollowUp,
  type Orcamento,
  type Paginado,
  type QuadroFunil,
  type ResumoOrcamentos,
} from '@gestao/shared-types';
import { estilosBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import {
  Cartao,
  CartaoCabecalho,
  CartaoItem,
  CartaoLista,
  CartaoTitulo,
} from '@/components/ui/cartao';
import { FaixaDeIndicadores, Indicador } from '@/components/ui/indicador';
import { apiComSessao } from '@/lib/api-servidor';
import { formatarQuando } from '@/lib/formatacao';

export const metadata: Metadata = {
  title: 'Painel',
};

/**
 * Painel inicial.
 *
 * Responde três perguntas, nesta ordem: quanto está em jogo, o que está parado,
 * e o que fazer agora. Um painel que só mostra totais é bonito e inútil — o que
 * muda o dia de quem abre o sistema é saber onde agir.
 */
export default async function PaginaPainel() {
  const [clientes, quadro, resumo, orcamentos, agendados, confirmados, lembretes] =
    await Promise.all([
      apiComSessao<Paginado<Cliente>>('/clientes?porPagina=1'),
      apiComSessao<QuadroFunil>('/funil'),
      apiComSessao<ResumoOrcamentos>('/orcamentos/resumo'),
      apiComSessao<Paginado<Orcamento>>('/orcamentos?status=aberto&porPagina=5'),
      apiComSessao<Paginado<Agendamento>>('/agendamentos?status=agendado&porPagina=5'),
      apiComSessao<Paginado<Agendamento>>('/agendamentos?status=confirmado&porPagina=5'),
      apiComSessao<Paginado<LembreteFollowUp>>('/lembretes?status=pendente&porPagina=5'),
    ]);

  if (clientes.meta.total === 0) {
    return <PrimeirosPassos />;
  }

  const noFunil = quadro.colunas.reduce((soma, coluna) => soma + coluna.clientes.length, 0);

  const proximosAgendamentos = [...agendados.dados, ...confirmados.dados]
    .sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime())
    .slice(0, 5);

  // Negociações que não se movem há mais de uma semana. É o número que revela
  // dinheiro esquecido — o resto do painel mostra o que já está em andamento.
  //
  // Os dias são calculados uma vez por cliente e carregados junto, em vez de
  // recalculados dentro do comparador: ali a conta rodaria a cada comparação.
  const paradas = quadro.colunas
    .flatMap((coluna) =>
      coluna.clientes.map((cliente) => ({
        cliente,
        etapa: coluna.etapa.nome,
        dias: diasNaEtapa(cliente.atualizadoEm),
      })),
    )
    .filter(({ dias }) => dias >= DIAS_PARA_ALERTA)
    .sort((a, b) => b.dias - a.dias)
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-8">
      <CabecalhoPagina titulo="Painel" descricao="A situação do seu negócio agora." />

      <FaixaDeIndicadores>
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
          tom="positivo"
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
      </FaixaDeIndicadores>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloco
          titulo="Próximos compromissos"
          href="/painel/agenda"
          rotuloLink="ver agenda"
          icone={CalendarClock}
          vazio="Nenhum compromisso pendente."
          itens={proximosAgendamentos}
          renderizar={(agendamento) => (
            <CartaoItem key={agendamento.id}>
              <div className="flex min-w-0 flex-col">
                <Link
                  href={`/painel/agenda/${agendamento.id}`}
                  className="truncate text-sm font-medium underline-offset-4 hover:underline"
                >
                  {agendamento.clienteNome}
                </Link>
                <span className="text-muted-foreground truncate text-xs">
                  {agendamento.servicoNome ?? 'Sem serviço do catálogo'} ·{' '}
                  {ROTULO_STATUS_AGENDAMENTO[agendamento.status]}
                </span>
              </div>

              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {formatarQuando(agendamento.dataHora)}
              </span>
            </CartaoItem>
          )}
        />

        <Bloco
          titulo="Follow-ups pendentes"
          href="/painel/lembretes"
          rotuloLink="ver lembretes"
          icone={BellRing}
          vazio="Nenhum follow-up pendente."
          itens={lembretes.dados}
          renderizar={(lembrete) => (
            <CartaoItem key={lembrete.id}>
              <div className="flex min-w-0 flex-col">
                <Link
                  href={`/painel/clientes/${lembrete.clienteId}`}
                  className="truncate text-sm font-medium underline-offset-4 hover:underline"
                >
                  {lembrete.clienteNome}
                </Link>
                <span className="text-muted-foreground text-xs">
                  {ROTULO_CANAL_LEMBRETE[lembrete.canal]}
                </span>
              </div>

              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {formatarQuando(lembrete.dataEnvio)}
              </span>
            </CartaoItem>
          )}
        />

        <Bloco
          titulo={`Paradas há mais de ${DIAS_PARA_ALERTA} dias`}
          href="/painel/funil"
          rotuloLink="ver funil"
          icone={Hourglass}
          vazio="Nenhuma negociação parada. Bom sinal."
          itens={paradas}
          renderizar={({ cliente, etapa, dias }) => (
            <CartaoItem key={cliente.id}>
              <div className="flex min-w-0 flex-col">
                <Link
                  href={`/painel/clientes/${cliente.id}`}
                  className="truncate text-sm font-medium underline-offset-4 hover:underline"
                >
                  {cliente.nome}
                </Link>
                <span className="text-muted-foreground truncate text-xs">{etapa}</span>
              </div>

              <span className="text-atencao shrink-0 text-xs font-medium tabular-nums">
                {dias} dias
              </span>
            </CartaoItem>
          )}
        />

        <Bloco
          titulo="Orçamentos aguardando resposta"
          href="/painel/orcamentos?status=aberto"
          rotuloLink="ver todos"
          icone={FileText}
          vazio="Nenhum orçamento em aberto."
          itens={orcamentos.dados}
          renderizar={(orcamento) => (
            <CartaoItem key={orcamento.id}>
              <Link
                href={`/painel/orcamentos/${orcamento.id}`}
                className="min-w-0 truncate text-sm underline-offset-4 hover:underline"
              >
                {orcamento.clienteNome}
              </Link>

              <span className="shrink-0 text-sm font-medium tabular-nums">
                {formatarBRL(orcamento.valor)}
              </span>
            </CartaoItem>
          )}
        />
      </div>
    </div>
  );
}

/**
 * Bloco de lista do painel.
 *
 * Os quatro blocos da tela têm exatamente a mesma anatomia — título, link para
 * a tela cheia, e uma lista curta ou uma frase de vazio. Escrever isso quatro
 * vezes foi o que deixou os espaçamentos diferentes entre eles.
 *
 * O vazio aqui é uma frase, e não o `EstadoVazio` cheio: dentro de um bloco de
 * meia largura, a versão com ícone e ação ocuparia mais espaço que a lista que
 * ela substitui.
 */
function Bloco<T>({
  titulo,
  href,
  rotuloLink,
  icone: Icone,
  vazio,
  itens,
  renderizar,
}: {
  titulo: string;
  href: string;
  rotuloLink: string;
  icone: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  vazio: string;
  itens: T[];
  renderizar: (item: T) => React.ReactNode;
}) {
  return (
    <Cartao className="flex flex-col">
      <CartaoCabecalho>
        <CartaoTitulo className="flex items-center gap-2">
          <Icone aria-hidden className="text-muted-foreground size-4" />
          {titulo}
        </CartaoTitulo>

        <Link
          href={href}
          className="text-muted-foreground hover:text-foreground shrink-0 text-xs underline-offset-4 transition-colors hover:underline"
        >
          {rotuloLink}
        </Link>
      </CartaoCabecalho>

      {itens.length === 0 ? (
        <p className="text-muted-foreground flex-1 px-4 py-10 text-center text-sm">{vazio}</p>
      ) : (
        <CartaoLista>{itens.map(renderizar)}</CartaoLista>
      )}
    </Cartao>
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
      <CabecalhoPagina
        titulo="Bem-vindo"
        descricao="Sua empresa está criada e o funil já vem configurado. Três passos para começar:"
      />

      <ol className="flex flex-col gap-3">
        {passos.map((passo, indice) => (
          <li key={passo.href}>
            <Cartao className="flex flex-wrap items-center gap-4 p-4">
              <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums">
                {indice + 1}
              </span>

              <div className="flex min-w-[12rem] flex-1 flex-col gap-0.5">
                <p className="font-medium">{passo.titulo}</p>
                <p className="text-muted-foreground text-sm">{passo.descricao}</p>
              </div>

              <Link href={passo.href} className={estilosBotao({ variante: 'secundario' })}>
                {passo.rotulo}
              </Link>
            </Cartao>
          </li>
        ))}
      </ol>
    </div>
  );
}
