import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  BellRing,
  CalendarClock,
  CalendarPlus,
  FileText,
  HeartHandshake,
  Hourglass,
  Inbox,
  Info,
  KanbanSquare,
  MessageCircle,
  Phone,
  TriangleAlert,
} from 'lucide-react';
import {
  DIAS_PARA_REATIVACAO,
  formatarBRL,
  formatarEspera,
  possuiPermissao,
  ROTULO_MOTIVO_REATIVACAO,
  ROTULO_SITUACAO_LEAD,
  type AlertaDoPainel,
  type BlocoFunil,
  type MotivoReativacao,
  type PainelTempoReal,
  type SituacaoLead,
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
import { linkTelefone, linkWhatsApp } from '@/lib/contato';
import { formatarQuando } from '@/lib/formatacao';
import { lerUsuarioDaSessao } from '@/lib/sessao';
import { cn } from '@/lib/utils';
import { AtualizacaoAutomatica } from './atualizacao-automatica';
import { GraficoResumoPainel } from './grafico-resumo-painel';
import { NovoLead } from './novo-lead';

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
  const [painel, usuario] = await Promise.all([
    apiComSessao<PainelTempoReal>('/painel/tempo-real'),
    lerUsuarioDaSessao(),
  ]);

  if (painel.totalClientes === 0) {
    return <PrimeirosPassos />;
  }

  const { leads, funil, comercial, agenda, followUps, reativacao, financeiro } = painel;

  // Sem cookie legível, o botão aparece: a API recusa de verdade quem não pode
  // cadastrar, e esconder a ação de um administrador por causa de um cookie
  // ausente seria o pior dos dois erros possíveis.
  const podeCriarLead = !usuario || possuiPermissao(usuario, 'clientes.criar');

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
            href="#leads"
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

      {/*
        Leads e reativação abrem a área de blocos, lado a lado: são a fila de
        entrada e a fila de saída da carteira, e é por elas que o dia começa.
        Os dois não têm tela própria — o cartão é a lista inteira.
      */}
      <div className="grid gap-4 lg:grid-cols-2">
        {leads && <CartaoLeads leads={leads} podeCriar={podeCriarLead} />}
        {reativacao && <CartaoReativacao reativacao={reativacao} />}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
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

const TOM_DA_SITUACAO: Record<SituacaoLead, 'atencao' | 'info' | 'neutro' | 'sucesso'> = {
  aguardando: 'atencao',
  em_contato: 'info',
  com_proposta: 'neutro',
  ganho: 'sucesso',
};

/**
 * O tom carrega significado: verde é quem já comprou (a melhor ligação),
 * vermelho é recusa explícita, âmbar é silêncio, cinza é quem nunca avançou.
 */
const TOM_DO_MOTIVO: Record<MotivoReativacao, 'sucesso' | 'perigo' | 'atencao' | 'neutro'> = {
  comprou_e_sumiu: 'sucesso',
  proposta_recusada: 'perigo',
  proposta_sem_resposta: 'atencao',
  nunca_fechou: 'neutro',
};

/**
 * Cartão de leads: a fila de entrada do CRM, com a porta de entrada junto.
 *
 * Não é amostra com link para uma tela maior — leads não tem tela própria. O
 * cartão responde sozinho as três perguntas do começo do dia (quem chegou, em
 * que pé está, quem ainda não recebeu contato) e resolve a quarta: **registrar
 * o que acabou de chegar**, sem sair daqui.
 *
 * O "Novo lead" fica na linha do resumo, e não no cabeçalho: aberto, o
 * formulário precisa da largura inteira do cartão, e ali ele quebra para a
 * própria linha sem espremer o título.
 */
function CartaoLeads({
  leads,
  podeCriar,
}: {
  leads: NonNullable<PainelTempoReal['leads']>;
  /** Cortesia com o usuário: quem não pode cadastrar não vê o botão. A API é quem recusa de verdade. */
  podeCriar: boolean;
}) {
  const emContato = Math.max(
    0,
    leads.noPeriodo - leads.aguardandoContato - leads.comProposta - leads.ganhos,
  );

  return (
    <Cartao id="leads" className="flex scroll-mt-4 flex-col">
      <CartaoCabecalho>
        <CartaoTitulo className="flex items-center gap-2">
          <Inbox aria-hidden className="text-muted-foreground size-4" />
          Leads que chegaram
        </CartaoTitulo>

        <span className="text-muted-foreground shrink-0 text-xs">
          {leads.hoje} hoje · {leads.seteDias} em 7 dias
        </span>
      </CartaoCabecalho>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="flex flex-wrap gap-1.5">
          {leads.aguardandoContato > 0 && (
            <Selo tom="atencao" comPonto>
              {leads.aguardandoContato} aguardando
            </Selo>
          )}
          {emContato > 0 && (
            <Selo tom="info" comPonto>
              {emContato} em contato
            </Selo>
          )}
          {leads.comProposta > 0 && <Selo comPonto>{leads.comProposta} com proposta</Selo>}
          {leads.ganhos > 0 && (
            <Selo tom="sucesso" comPonto>
              {leads.ganhos} fechado(s)
            </Selo>
          )}
        </div>

        {podeCriar && <NovoLead origensConhecidas={leads.porOrigem.map((item) => item.origem)} />}
      </div>

      {leads.ultimos.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-10 text-center">
          <p className="text-muted-foreground text-sm">Nenhum lead novo nos últimos 30 dias.</p>
          <p className="text-muted-foreground max-w-xs text-xs">
            {podeCriar
              ? 'Use "Novo lead" aqui em cima para registrar quem acabou de entrar em contato.'
              : 'Quem for cadastrado como cliente aparece aqui automaticamente.'}
          </p>
        </div>
      ) : (
        <CartaoLista className="flex-1">
          {leads.ultimos.map((lead) => (
            <CartaoItem key={lead.id} className="gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <Link
                  href={`/painel/clientes/${lead.id}`}
                  className="truncate text-sm font-medium underline-offset-4 hover:underline"
                >
                  {lead.nome}
                </Link>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Selo tom={TOM_DA_SITUACAO[lead.situacao]}>
                    {ROTULO_SITUACAO_LEAD[lead.situacao]}
                  </Selo>
                  <span className="text-muted-foreground truncate text-xs">
                    {lead.origem ?? 'sem origem'}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    lead.situacao === 'aguardando'
                      ? 'text-atencao font-medium'
                      : 'text-muted-foreground',
                  )}
                >
                  {formatarEspera(lead.horasAteContato)}
                </span>

                <AcoesDeContato nome={lead.nome} telefone={lead.telefone} />
              </div>
            </CartaoItem>
          ))}
        </CartaoLista>
      )}

      <p className="text-muted-foreground border-t px-4 py-2.5 text-xs">
        {leads.noPeriodo} lead(s) em 30 dias
        {Number(leads.valorEmProposta) > 0 &&
          ` · ${formatarBRL(leads.valorEmProposta)} em proposta`}
        {leads.semContatoNoPrazo > 0 && (
          <span className="text-destructive font-medium">
            {' '}
            · {leads.semContatoNoPrazo} esperando há mais de 24 h
          </span>
        )}
      </p>
    </Cartao>
  );
}

/**
 * Cartão de reativação: a fila de quem esfriou, ordenada por quanto já gastou.
 *
 * O cliente frio não aparece em lugar nenhum do sistema — não tem proposta
 * aberta, agendamento nem lembrete pendente — e é justamente por isso que ele
 * some. Aqui ele aparece com o motivo (que muda a conversa), há quantos dias
 * sumiu, quanto já fechou, e os dois gestos que resolvem: falar agora ou marcar
 * o retorno.
 */
function CartaoReativacao({
  reativacao,
}: {
  reativacao: NonNullable<PainelTempoReal['reativacao']>;
}) {
  return (
    <Cartao id="reativacao" className="flex scroll-mt-4 flex-col">
      <CartaoCabecalho>
        <CartaoTitulo className="flex items-center gap-2">
          <HeartHandshake aria-hidden className="text-muted-foreground size-4" />
          Clientes para reativar
        </CartaoTitulo>

        <span className="text-muted-foreground shrink-0 text-xs">
          sem contato há {DIAS_PARA_REATIVACAO}+ dias
        </span>
      </CartaoCabecalho>

      {reativacao.porMotivo.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b px-4 py-2.5">
          {reativacao.porMotivo.map((item) => (
            <Selo key={item.motivo} tom={TOM_DO_MOTIVO[item.motivo]} comPonto>
              {item.total} {ROTULO_MOTIVO_REATIVACAO[item.motivo].toLowerCase()}
            </Selo>
          ))}
        </div>
      )}

      {reativacao.principais.length === 0 ? (
        <p className="text-muted-foreground flex-1 px-4 py-10 text-center text-sm">
          Nenhum cliente esfriou. Bom sinal.
        </p>
      ) : (
        <CartaoLista className="flex-1">
          {reativacao.principais.map((cliente) => (
            <CartaoItem key={cliente.id} className="gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <Link
                  href={`/painel/clientes/${cliente.id}`}
                  className="truncate text-sm font-medium underline-offset-4 hover:underline"
                >
                  {cliente.nome}
                </Link>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Selo tom={TOM_DO_MOTIVO[cliente.motivo]}>
                    {ROTULO_MOTIVO_REATIVACAO[cliente.motivo]}
                  </Selo>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {cliente.diasSemContato} dias
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {Number(cliente.valorHistorico) > 0 && (
                  <span className="text-xs font-medium tabular-nums">
                    {formatarBRL(cliente.valorHistorico)}
                  </span>
                )}

                <AcoesDeContato
                  nome={cliente.nome}
                  telefone={cliente.telefone}
                  lembreteDe={cliente.id}
                />
              </div>
            </CartaoItem>
          ))}
        </CartaoLista>
      )}

      {/*
        O total vem do banco; a quebra por motivo e o valor vêm dos que foram
        ranqueados. Numa carteira grande os dois números diferem, e o rodapé diz
        isso em vez de deixar a soma dos selos parecer errada.
      */}
      <p className="text-muted-foreground border-t px-4 py-2.5 text-xs">
        {reativacao.total} cliente(s) frio(s)
        {reativacao.total > reativacao.analisados && ` · ${reativacao.analisados} analisados`}
        {Number(reativacao.valorHistorico) > 0 &&
          ` · ${formatarBRL(reativacao.valorHistorico)} já fechados com eles`}
      </p>
    </Cartao>
  );
}

/**
 * Falar com a pessoa, sem sair do painel.
 *
 * O gesto seguinte a ver "chegou há 3 h e ninguém atendeu" ou "sumiu há 150
 * dias" não é abrir a ficha: é ligar ou mandar mensagem. Sem estes atalhos, o
 * caminho seria abrir o cliente, selecionar o telefone, copiar e colar no
 * WhatsApp — quatro passos para algo que acontece dezenas de vezes por dia.
 *
 * Sem telefone cadastrado, nada é oferecido: um botão que abre uma conversa com
 * número quebrado é pior que botão nenhum.
 */
function AcoesDeContato({
  nome,
  telefone,
  lembreteDe,
}: {
  nome: string;
  telefone: string | null;
  /** Quando informado, oferece marcar o retorno para este cliente. */
  lembreteDe?: string;
}) {
  const whatsapp = linkWhatsApp(telefone);
  const chamada = linkTelefone(telefone);

  return (
    <div className="flex items-center gap-0.5">
      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noreferrer"
          aria-label={`Conversar com ${nome} no WhatsApp`}
          className="hover:bg-accent text-muted-foreground hover:text-foreground rounded-md p-1.5 transition-colors"
        >
          <MessageCircle aria-hidden className="size-4" />
        </a>
      )}

      {chamada && (
        <a
          href={chamada}
          aria-label={`Ligar para ${nome}`}
          className="hover:bg-accent text-muted-foreground hover:text-foreground rounded-md p-1.5 transition-colors"
        >
          <Phone aria-hidden className="size-4" />
        </a>
      )}

      {lembreteDe && (
        <Link
          href={`/painel/lembretes/novo?cliente=${lembreteDe}`}
          aria-label={`Agendar retorno para ${nome}`}
          className="hover:bg-accent text-muted-foreground hover:text-foreground rounded-md p-1.5 transition-colors"
        >
          <CalendarPlus aria-hidden className="size-4" />
        </Link>
      )}
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
