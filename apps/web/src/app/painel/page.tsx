import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  BellRing,
  CalendarClock,
  FileText,
  HeartHandshake,
  Hourglass,
  Inbox,
  Info,
  KanbanSquare,
  TriangleAlert,
} from 'lucide-react';
import {
  formatarBRL,
  formatarEspera,
  ROTULO_MOTIVO_REATIVACAO,
  ROTULO_SITUACAO_LEAD,
  type AlertaDoPainel,
  type BlocoFunil,
  type PainelTempoReal,
  type TomAlerta,
} from '@gestao/shared-types';
import { estilosBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import {
  Cartao,
  CartaoCabecalho,
  CartaoConteudo,
  CartaoItem,
  CartaoLista,
  CartaoTitulo,
} from '@/components/ui/cartao';
import { FaixaDeIndicadores, Indicador } from '@/components/ui/indicador';
import { Selo } from '@/components/ui/selo';
import { apiComSessao } from '@/lib/api-servidor';
import { formatarQuando } from '@/lib/formatacao';
import { cn } from '@/lib/utils';
import { AtualizacaoAutomatica } from './atualizacao-automatica';
import { GraficoResumoPainel } from './grafico-resumo-painel';

export const metadata: Metadata = {
  title: 'Painel',
};

/**
 * Painel inicial.
 *
 * Responde, nesta ordem: **o que precisa de mim agora**, **quanto está em
 * jogo**, **o que está entrando**, **o que está parado** e **o que acabou de
 * acontecer**. Um painel que só mostra totais é bonito e inútil — o que muda o
 * dia de quem abre o sistema é saber onde agir.
 *
 * ## Uma requisição, um instante
 *
 * A tela buscava doze coisas em doze requisições. Agora é uma só: a API lê tudo
 * na mesma transação e carimba o instante. Isso é o que torna possível a
 * atualização automática — doze requisições a cada trinta segundos seriam
 * carga inútil, e ainda mostrariam números lidos em momentos diferentes lado a
 * lado.
 *
 * ## Permissão decide o que existe
 *
 * Os blocos chegam `null` quando falta permissão (§9.5); a tela simplesmente
 * não os desenha. Quem não pode ver dinheiro não recebe os números de caixa —
 * eles não saem do banco.
 */
export default async function PaginaPainel() {
  const painel = await apiComSessao<PainelTempoReal>('/painel/tempo-real');

  if (painel.totalClientes === 0) {
    return <PrimeirosPassos />;
  }

  const { leads, funil, comercial, agenda, followUps, reativacao, financeiro } = painel;

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Painel"
        descricao="O que está acontecendo no seu negócio agora."
        acoes={
          <AtualizacaoAutomatica
            geradoEm={painel.geradoEm}
            intervaloSegundos={painel.recarregarEmSegundos}
          />
        }
      />

      {painel.alertas.length > 0 && <FaixaDeAlertas alertas={painel.alertas} />}

      <FaixaDeIndicadores>
        {leads && (
          <Indicador
            titulo="Leads hoje"
            valor={String(leads.hoje)}
            detalhe={`${leads.seteDias} nos últimos 7 dias`}
            href="/painel/leads"
            destaque={leads.hoje > 0}
          />
        )}

        {comercial && (
          <Indicador
            titulo="Em negociação"
            valor={formatarBRL(comercial.abertos.valor)}
            detalhe={`${comercial.abertos.quantidade} proposta(s) em aberto`}
            href="/painel/orcamentos?status=aberto"
          />
        )}

        {comercial && (
          <Indicador
            titulo="Fechado no mês"
            valor={formatarBRL(comercial.aprovadosMes.valor)}
            detalhe={`${Math.round(comercial.taxaConversaoMes * 100)}% das respondidas · ticket ${formatarBRL(comercial.ticketMedio)}`}
            href="/painel/orcamentos?status=aprovado"
            tom={Number(comercial.aprovadosMes.valor) > 0 ? 'positivo' : 'neutro'}
          />
        )}

        {financeiro && (
          <Indicador
            titulo="Caixa do mês"
            valor={formatarBRL(financeiro.saldoMes)}
            detalhe={`${formatarBRL(financeiro.entradasMes)} entraram · ${formatarBRL(financeiro.saidasMes)} saíram`}
            href="/painel/financeiro"
            tom={Number(financeiro.saldoMes) < 0 ? 'negativo' : 'positivo'}
          />
        )}

        {!financeiro && agenda && (
          <Indicador
            titulo="Agenda de hoje"
            valor={String(agenda.hoje.length)}
            detalhe={`${agenda.seteDias} nos próximos 7 dias`}
            href="/painel/agenda"
          />
        )}
      </FaixaDeIndicadores>

      <div className="grid gap-4 lg:grid-cols-2">
        {leads && (
          <Bloco
            titulo="Chegaram agora"
            href="/painel/leads"
            rotuloLink="ver leads"
            icone={Inbox}
            vazio="Nenhum lead novo no período."
            rodape={
              leads.aguardandoContato > 0
                ? `${leads.aguardandoContato} aguardando contato · ${formatarBRL(leads.valorEmProposta)} em proposta`
                : `${formatarBRL(leads.valorEmProposta)} em proposta`
            }
            itens={leads.ultimos}
            renderizar={(lead) => (
              <CartaoItem key={lead.id}>
                <div className="flex min-w-0 flex-col">
                  <Link
                    href={`/painel/clientes/${lead.id}`}
                    className="truncate text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {lead.nome}
                  </Link>
                  <span className="text-muted-foreground truncate text-xs">
                    {lead.origem ?? 'sem origem'} · {ROTULO_SITUACAO_LEAD[lead.situacao]}
                  </span>
                </div>

                <span
                  className={cn(
                    'shrink-0 text-xs tabular-nums',
                    lead.situacao === 'aguardando'
                      ? 'text-atencao font-medium'
                      : 'text-muted-foreground',
                  )}
                >
                  {formatarEspera(lead.horasAteContato)}
                </span>
              </CartaoItem>
            )}
          />
        )}

        {funil && <BlocoDoFunil funil={funil} />}

        {agenda && (
          <Bloco
            titulo="Agenda de hoje"
            href="/painel/agenda"
            rotuloLink="ver agenda"
            icone={CalendarClock}
            vazio="Nenhum compromisso para hoje."
            rodape={`${agenda.amanha} amanhã · ${agenda.seteDias} nos próximos 7 dias${agenda.atrasados > 0 ? ` · ${agenda.atrasados} em atraso` : ''}`}
            itens={agenda.hoje}
            renderizar={(compromisso) => (
              <CartaoItem key={compromisso.id}>
                <div className="flex min-w-0 flex-col">
                  <Link
                    href={`/painel/agenda/${compromisso.id}`}
                    className="truncate text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {compromisso.clienteNome}
                  </Link>
                  <span className="text-muted-foreground truncate text-xs">
                    {compromisso.servicoNome ?? 'sem serviço do catálogo'}
                  </span>
                </div>

                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {formatarQuando(compromisso.dataHora)}
                </span>
              </CartaoItem>
            )}
          />
        )}

        {followUps && (
          <Bloco
            titulo="Follow-ups pendentes"
            href="/painel/lembretes"
            rotuloLink="ver lembretes"
            icone={BellRing}
            vazio="Nenhum follow-up pendente."
            rodape={
              followUps.falhasRecentes > 0
                ? `${followUps.pendentes} pendente(s) · ${followUps.falhasRecentes} falha(s) nos últimos 7 dias`
                : `${followUps.pendentes} pendente(s) · ${followUps.atrasados} atrasado(s)`
            }
            itens={followUps.proximos}
            renderizar={(lembrete) => (
              <CartaoItem key={lembrete.id}>
                <Link
                  href={`/painel/clientes/${lembrete.clienteId}`}
                  className="min-w-0 truncate text-sm font-medium underline-offset-4 hover:underline"
                >
                  {lembrete.clienteNome}
                </Link>

                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {formatarQuando(lembrete.dataEnvio)}
                </span>
              </CartaoItem>
            )}
          />
        )}

        {reativacao && (
          <Bloco
            titulo="Para reativar"
            href="/painel/reativacao"
            rotuloLink="ver lista"
            icone={HeartHandshake}
            vazio="Nenhum cliente esfriou. Bom sinal."
            rodape={`${reativacao.total} cliente(s) frio(s) · ${formatarBRL(reativacao.valorHistorico)} já fechados com eles`}
            itens={reativacao.principais}
            renderizar={(cliente) => (
              <CartaoItem key={cliente.id}>
                <div className="flex min-w-0 flex-col">
                  <Link
                    href={`/painel/clientes/${cliente.id}`}
                    className="truncate text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {cliente.nome}
                  </Link>
                  <span className="text-muted-foreground truncate text-xs">
                    {ROTULO_MOTIVO_REATIVACAO[cliente.motivo]} · {cliente.diasSemContato} dias
                  </span>
                </div>

                <span className="shrink-0 text-xs font-medium tabular-nums">
                  {Number(cliente.valorHistorico) > 0 ? formatarBRL(cliente.valorHistorico) : '—'}
                </span>
              </CartaoItem>
            )}
          />
        )}

        {comercial && (
          <Bloco
            titulo="Propostas vencendo"
            href="/painel/orcamentos?status=aberto"
            rotuloLink="ver orçamentos"
            icone={FileText}
            vazio="Nenhuma proposta perto do prazo."
            rodape={`${comercial.abertos.quantidade} em aberto · ${formatarBRL(comercial.abertos.valor)}`}
            itens={comercial.vencendo}
            renderizar={(proposta) => (
              <CartaoItem key={proposta.id}>
                <div className="flex min-w-0 flex-col">
                  <Link
                    href={`/painel/orcamentos/${proposta.id}`}
                    className="truncate text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {proposta.clienteNome}
                  </Link>
                  <span
                    className={cn(
                      'text-xs',
                      proposta.diasRestantes < 0
                        ? 'text-destructive font-medium'
                        : 'text-muted-foreground',
                    )}
                  >
                    {proposta.diasRestantes < 0
                      ? `venceu há ${Math.abs(proposta.diasRestantes)} dia(s)`
                      : `vence em ${proposta.diasRestantes} dia(s)`}
                  </span>
                </div>

                <span className="shrink-0 text-sm font-medium tabular-nums">
                  {formatarBRL(proposta.valor)}
                </span>
              </CartaoItem>
            )}
          />
        )}

        {funil && funil.paradas.length > 0 && (
          <Bloco
            titulo="Negociações paradas"
            href="/painel/funil"
            rotuloLink="ver funil"
            icone={Hourglass}
            vazio="Nenhuma negociação parada."
            itens={funil.paradas}
            renderizar={(parada) => (
              <CartaoItem key={parada.clienteId}>
                <div className="flex min-w-0 flex-col">
                  <Link
                    href={`/painel/clientes/${parada.clienteId}`}
                    className="truncate text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {parada.nome}
                  </Link>
                  <span className="text-muted-foreground truncate text-xs">{parada.etapa}</span>
                </div>

                <div className="flex shrink-0 flex-col items-end">
                  <span className="text-atencao text-xs font-medium tabular-nums">
                    {parada.dias} dias
                  </span>
                  {parada.valor && (
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {formatarBRL(parada.valor)}
                    </span>
                  )}
                </div>
              </CartaoItem>
            )}
          />
        )}
      </div>

      {financeiro && <GraficoResumoPainel serie={financeiro.serie} />}

      {financeiro && <ContasEmAberto financeiro={financeiro} />}

      {painel.atividade.length > 0 && <Atividade eventos={painel.atividade} />}
    </div>
  );
}

const ICONE_DO_TOM: Record<TomAlerta, typeof AlertTriangle> = {
  perigo: TriangleAlert,
  atencao: AlertTriangle,
  info: Info,
};

const ESTILO_DO_TOM: Record<TomAlerta, string> = {
  perigo: 'border-destructive/25 bg-destrutivo-suave/50 text-destructive',
  atencao: 'border-atencao/30 bg-atencao-suave/50 text-atencao',
  info: 'border-border bg-muted/40 text-muted-foreground',
};

/**
 * O que precisa de alguém agora.
 *
 * Vem pronta do servidor, ordenada por gravidade: quem abre o painel lê de cima
 * para baixo e para quando resolve. Cada alerta é um link — avisar sem levar ao
 * lugar onde se resolve seria só ansiedade.
 */
function FaixaDeAlertas({ alertas }: { alertas: AlertaDoPainel[] }) {
  return (
    <section aria-label="Alertas" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {alertas.map((alerta) => {
        const Icone = ICONE_DO_TOM[alerta.tom];

        return (
          <Link
            key={alerta.id}
            href={alerta.href}
            className={cn(
              'flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors hover:brightness-[0.98]',
              ESTILO_DO_TOM[alerta.tom],
            )}
          >
            <Icone aria-hidden className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{alerta.titulo}</p>
              <p className="text-muted-foreground text-xs">{alerta.detalhe}</p>
            </div>
          </Link>
        );
      })}
    </section>
  );
}

/**
 * O funil inteiro numa coluna estreita.
 *
 * Barras horizontais em vez do kanban: aqui a pergunta não é "quem está em
 * cada etapa", é "onde o dinheiro está travado". A largura da barra compara as
 * etapas de relance; o valor escrito ao lado é o que se lê com precisão.
 */
function BlocoDoFunil({ funil }: { funil: BlocoFunil }) {
  const maior = Math.max(1, ...funil.etapas.map((etapa) => etapa.clientes));

  return (
    <Cartao className="flex flex-col">
      <CartaoCabecalho>
        <CartaoTitulo className="flex items-center gap-2">
          <KanbanSquare aria-hidden className="text-muted-foreground size-4" />
          Funil de vendas
        </CartaoTitulo>

        <Link
          href="/painel/funil"
          className="text-muted-foreground hover:text-foreground shrink-0 text-xs underline-offset-4 transition-colors hover:underline"
        >
          ver quadro
        </Link>
      </CartaoCabecalho>

      {funil.etapas.length === 0 ? (
        <p className="text-muted-foreground flex-1 px-4 py-10 text-center text-sm">
          Nenhuma etapa configurada.
        </p>
      ) : (
        <CartaoConteudo className="flex flex-1 flex-col gap-3">
          {funil.etapas.map((etapa) => (
            <div key={etapa.id} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm">{etapa.nome}</span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {etapa.clientes} {Number(etapa.valor) > 0 && `· ${formatarBRL(etapa.valor)}`}
                </span>
              </div>

              <span aria-hidden className="bg-muted block h-1.5 overflow-hidden rounded-full">
                <span
                  className="bg-grafico-1 block h-full rounded-full"
                  style={{ width: `${(etapa.clientes / maior) * 100}%` }}
                />
              </span>
            </div>
          ))}
        </CartaoConteudo>
      )}

      <p className="text-muted-foreground border-t px-4 py-2.5 text-xs">
        {funil.total} cliente(s) no funil
        {funil.foraDoFunil > 0 && ` · ${funil.foraDoFunil} fora dele`}
      </p>
    </Cartao>
  );
}

/**
 * O que ainda não virou dinheiro.
 *
 * A pagar e a receber separados, e os vencidos destacados: são ações opostas —
 * um é multa correndo, o outro é cobrança a fazer. Somados num número só, a
 * única leitura possível seria "tem algo errado".
 */
function ContasEmAberto({
  financeiro,
}: {
  financeiro: NonNullable<PainelTempoReal['financeiro']>;
}) {
  return (
    <Cartao>
      <CartaoCabecalho>
        <CartaoTitulo className="flex items-center gap-2">
          <Activity aria-hidden className="text-muted-foreground size-4" />
          Contas em aberto
        </CartaoTitulo>

        <Link
          href="/painel/financeiro"
          className="text-muted-foreground hover:text-foreground shrink-0 text-xs underline-offset-4 transition-colors hover:underline"
        >
          ver financeiro
        </Link>
      </CartaoCabecalho>

      <CartaoConteudo className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            A receber
          </p>
          <p className="text-sucesso mt-1 text-xl font-semibold tabular-nums">
            {formatarBRL(financeiro.aReceber)}
          </p>
          {financeiro.vencidosAReceber.quantidade > 0 && (
            <Selo tom="atencao" className="mt-2">
              {financeiro.vencidosAReceber.quantidade} vencida(s) ·{' '}
              {formatarBRL(financeiro.vencidosAReceber.valor)}
            </Selo>
          )}
        </div>

        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            A pagar
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {formatarBRL(financeiro.aPagar)}
          </p>
          {financeiro.vencidosAPagar.quantidade > 0 && (
            <Selo tom="perigo" className="mt-2">
              {financeiro.vencidosAPagar.quantidade} vencida(s) ·{' '}
              {formatarBRL(financeiro.vencidosAPagar.valor)}
            </Selo>
          )}
        </div>
      </CartaoConteudo>
    </Cartao>
  );
}

/**
 * O que acabou de acontecer.
 *
 * Sai do histórico de auditoria, filtrado pela API para mostrar só os eventos
 * das entidades que a pessoa poderia abrir. É o bloco que faz o painel parecer
 * vivo numa empresa com mais de uma pessoa trabalhando.
 */
function Atividade({ eventos }: { eventos: PainelTempoReal['atividade'] }) {
  return (
    <Cartao>
      <CartaoCabecalho>
        <CartaoTitulo className="flex items-center gap-2">
          <Activity aria-hidden className="text-muted-foreground size-4" />
          Acabou de acontecer
        </CartaoTitulo>
        <span className="text-muted-foreground text-xs">últimos registros</span>
      </CartaoCabecalho>

      <CartaoLista>
        {eventos.map((evento) => (
          <CartaoItem key={evento.id}>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm">{evento.resumo}</span>
              <span className="text-muted-foreground text-xs">{evento.usuarioNome}</span>
            </div>

            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {formatarQuando(evento.quando)}
            </span>
          </CartaoItem>
        ))}
      </CartaoLista>
    </Cartao>
  );
}

/**
 * Bloco de lista do painel.
 *
 * Os blocos da tela têm a mesma anatomia — título, link para a tela cheia, uma
 * lista curta e um rodapé com o total. Escrever isso sete vezes foi o que
 * deixou os espaçamentos diferentes entre eles.
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
  rodape,
  renderizar,
}: {
  titulo: string;
  href: string;
  rotuloLink: string;
  icone: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  vazio: string;
  itens: T[];
  /** Uma linha de total no pé do bloco — o contexto que a lista curta não dá. */
  rodape?: string;
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
        <CartaoLista className="flex-1">{itens.map(renderizar)}</CartaoLista>
      )}

      {rodape && <p className="text-muted-foreground border-t px-4 py-2.5 text-xs">{rodape}</p>}
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
      descricao: 'Nome e telefone já bastam para começar. Ele aparece na fila de leads.',
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
