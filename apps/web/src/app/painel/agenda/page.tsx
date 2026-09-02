import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, CalendarDays } from 'lucide-react';
import {
  ROTULO_STATUS_AGENDAMENTO,
  STATUS_AGENDAMENTO,
  estaAtrasado,
  formatarTelefone,
  type Agendamento,
  type Paginado,
  type StatusAgendamento,
} from '@gestao/shared-types';
import { estilosBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao, CartaoItem, CartaoLista } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { BarraDeFiltros, FiltroLink } from '@/components/ui/filtro-link';
import { Selo } from '@/components/ui/selo';
import { agruparPorDia } from '@/lib/agrupamento';
import { apiComSessao } from '@/lib/api-servidor';
import { formatarDiaAgenda, formatarHora } from '@/lib/formatacao';
import { AcoesAgendamento } from './acoes-agendamento';

export const metadata: Metadata = {
  title: 'Agenda',
};

/**
 * O tom de cada status.
 *
 * Âmbar é o que ainda depende de alguém, azul é combinado, verde é feito,
 * cinza é encerrado sem consequência. Sai dos tokens de significado do sistema
 * para casar com os selos do financeiro e dos orçamentos — antes cada tela
 * tinha a própria paleta e as três discordavam.
 */
const TOM_DO_STATUS: Record<StatusAgendamento, 'atencao' | 'info' | 'sucesso' | 'neutro'> = {
  agendado: 'atencao',
  confirmado: 'info',
  executado: 'sucesso',
  cancelado: 'neutro',
};

interface Props {
  searchParams: Promise<{ status?: string; de?: string; ate?: string; pagina?: string }>;
}

/**
 * Agenda de serviços.
 *
 * Agrupada por dia, e não em tabela corrida: quem abre esta tela quer saber o
 * que tem para hoje e para amanhã, não percorrer uma lista uniforme de
 * compromissos.
 */
export default async function PaginaAgenda({ searchParams }: Props) {
  const { status, de, ate, pagina = '1' } = await searchParams;

  const query = new URLSearchParams({ pagina, porPagina: '50' });
  if (status) query.set('status', status);
  if (de) query.set('de', de);
  if (ate) query.set('ate', ate);

  const agenda = await apiComSessao<Paginado<Agendamento>>(`/agendamentos?${query.toString()}`);

  const atrasados = agenda.dados.filter(estaAtrasado);
  const porDia = agruparPorDia(agenda.dados, (agendamento) => agendamento.dataHora);

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Agenda"
        descricao={
          agenda.meta.total === 0
            ? 'Nenhum serviço agendado.'
            : `${agenda.meta.total} ${agenda.meta.total === 1 ? 'compromisso' : 'compromissos'}.`
        }
        acoes={
          <Link href="/painel/agenda/novo" className={estilosBotao()}>
            Novo agendamento
          </Link>
        }
      />

      {/* Compromissos vencidos sem desfecho vêm primeiro: são os que exigem uma
          decisão — foi feito? foi cancelado? — e somem da agenda se ninguém age. */}
      {atrasados.length > 0 && (
        <section className="border-destructive/40 bg-destructive/5 flex items-start gap-3 rounded-lg border p-4">
          <AlertTriangle aria-hidden className="text-destructive mt-0.5 size-4 shrink-0" />

          <div className="flex flex-col gap-1">
            <h2 className="text-destructive text-sm font-medium">
              {atrasados.length}{' '}
              {atrasados.length === 1 ? 'compromisso passou' : 'compromissos passaram'} da data
            </h2>
            <p className="text-muted-foreground text-sm">
              Marque como executado ou cancele para tirá-los da lista.
            </p>
          </div>
        </section>
      )}

      <BarraDeFiltros rotulo="Filtrar por status">
        <FiltroLink base="/painel/agenda" parametro="status" atual={status} rotulo="Todos" />
        {STATUS_AGENDAMENTO.map((valor) => (
          <FiltroLink
            key={valor}
            base="/painel/agenda"
            parametro="status"
            valor={valor}
            atual={status}
            rotulo={ROTULO_STATUS_AGENDAMENTO[valor]}
          />
        ))}
      </BarraDeFiltros>

      {agenda.dados.length === 0 ? (
        <EstadoVazio
          icone={CalendarDays}
          titulo="Agenda vazia"
          descricao={
            status
              ? 'Nenhum compromisso com este status.'
              : 'Agende o primeiro serviço para acompanhar o que precisa ser feito.'
          }
          acao={
            status ? undefined : (
              <Link href="/painel/agenda/novo" className={estilosBotao({ tamanho: 'sm' })}>
                Novo agendamento
              </Link>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {porDia.map(({ dia, itens }) => (
            <section key={dia} className="flex flex-col gap-2">
              <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {formatarDiaAgenda(dia)}
              </h2>

              <Cartao>
                <CartaoLista>
                  {itens.map((agendamento) => (
                    <CartaoItem key={agendamento.id} className="flex-wrap items-start gap-4 p-4">
                      <div className="flex min-w-0 flex-1 gap-4">
                        <span className="text-sm font-semibold tabular-nums">
                          {formatarHora(agendamento.dataHora)}
                        </span>

                        <div className="flex min-w-0 flex-col gap-1">
                          <Link
                            href={`/painel/agenda/${agendamento.id}`}
                            className="truncate text-sm font-medium underline-offset-4 hover:underline"
                          >
                            {agendamento.clienteNome}
                          </Link>

                          <span className="text-muted-foreground truncate text-xs">
                            {agendamento.servicoNome ?? 'Sem serviço do catálogo'}
                            {agendamento.clienteTelefone &&
                              ` · ${formatarTelefone(agendamento.clienteTelefone)}`}
                          </span>

                          <span className="flex flex-wrap items-center gap-2">
                            {/* A cor nunca é o único sinal: o texto acompanha sempre. */}
                            <Selo tom={TOM_DO_STATUS[agendamento.status]}>
                              {ROTULO_STATUS_AGENDAMENTO[agendamento.status]}
                            </Selo>

                            {estaAtrasado(agendamento) && (
                              <span className="text-destructive text-xs font-medium">
                                passou da data
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      <AcoesAgendamento id={agendamento.id} status={agendamento.status} />
                    </CartaoItem>
                  ))}
                </CartaoLista>
              </Cartao>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
