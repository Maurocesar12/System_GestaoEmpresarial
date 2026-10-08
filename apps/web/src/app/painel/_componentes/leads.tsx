import Link from 'next/link';
import { CalendarPlus, HeartHandshake, Inbox, MessageCircle, Phone } from 'lucide-react';
import {
  formatarBRL,
  formatarEspera,
  ROTULO_MOTIVO_REATIVACAO,
  ROTULO_SITUACAO_LEAD,
  type MotivoReativacao,
  type PainelTempoReal,
  type SituacaoLead,
} from '@gestao/shared-types';
import {
  Cartao,
  CartaoCabecalho,
  CartaoItem,
  CartaoLista,
  CartaoTitulo,
} from '@/components/ui/cartao';
import { Selo } from '@/components/ui/selo';
import { linkTelefone, linkWhatsApp } from '@/lib/contato';
import { cn } from '@/lib/utils';
import { NovoLead } from '../novo-lead';

/** Blocos de leads do painel: quem pediu contato e quem esfriou. */

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
export function CartaoLeads({
  leads,
  podeCriar,
}: {
  leads: NonNullable<PainelTempoReal['leads']>;
  /** Cortesia com o usuário: quem não pode cadastrar não vê o botão. A API é quem recusa de verdade. */
  podeCriar: boolean;
}) {
  const { emContato } = leads;

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
export function CartaoReativacao({
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
          sem contato há {reativacao.diasSemContato}+ dias
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
