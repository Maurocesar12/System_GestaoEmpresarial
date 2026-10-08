import type { Metadata } from 'next';
import Link from 'next/link';
import { BellRing, CalendarClock, FileText, Hourglass } from 'lucide-react';
import { formatarBRL, type PainelTempoReal } from '@gestao/shared-types';
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
import { lerUsuarioDaSessao } from '@/lib/sessao';
import { cn } from '@/lib/utils';
import { pode } from '@/lib/permissoes';
import { AtualizacaoAutomatica } from './atualizacao-automatica';
import { GraficoResumoPainel } from './grafico-resumo-painel';
import { CartaoLeads, CartaoReativacao } from './_componentes/leads';
import { FaixaDeAlertas } from './_componentes/alertas';
import { BlocoDoFunil, ContasEmAberto } from './_componentes/funil-e-contas';
import { Atividade, PrimeirosPassos } from './_componentes/atividade';

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
  const podeCriarLead = !usuario || pode(usuario, 'clientes.criar');

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

      {/*
        O dinheiro vem antes da operação, e não no fim da página. Ele estava
        depois de cinco blocos — quem abria o painel rolava meia tela até o
        número que mais decide o dia.
      */}
      {financeiro && (
        <GraficoResumoPainel serie={financeiro.serie} resumo={financeiro.resumoSerie} />
      )}

      {financeiro && <ContasEmAberto financeiro={financeiro} />}

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

      {painel.atividade.length > 0 && <Atividade eventos={painel.atividade} />}
    </div>
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
