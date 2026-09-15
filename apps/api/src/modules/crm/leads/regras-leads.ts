import type { LeadsQuery, MotivoReativacao, SituacaoLead } from '@gestao/shared-types';
import type { Prisma } from '../../../generated/prisma/client';

/**
 * As regras que definem lead e cliente frio.
 *
 * Moram fora do serviço porque **duas telas diferentes as usam**: a fila de
 * entrada e o painel em tempo real. Se cada um montasse o próprio `where`, o
 * painel diria "4 leads aguardando" e a tela de leads listaria cinco — e a
 * divergência apareceria justamente para quem confiou no número.
 *
 * São funções puras: recebem as datas de corte já calculadas e devolvem filtro.
 * Nada aqui toca o banco nem lê o relógio, o que também as torna testáveis sem
 * infraestrutura.
 */

export const MS_POR_DIA = 24 * 60 * 60 * 1000;
export const MS_POR_HORA = 60 * 60 * 1000;

/** Um lead sem nenhum sinal de trabalho humano: ninguém encostou nele ainda. */
export const SEM_NENHUM_CONTATO = {
  atendimentos: { none: {} },
  agendamentos: { none: {} },
  orcamentos: { none: {} },
} satisfies Prisma.ClienteWhereInput;

/** Cliente anonimizado a pedido do titular não entra em fila nem em contagem. */
export const CLIENTE_ATIVO = { anonimizadoEm: null } satisfies Prisma.ClienteWhereInput;

/**
 * Filtro do que é lead.
 *
 * Cliente é "lead" pelo tempo de casa, e não por um campo próprio: quem entrou
 * na base nos últimos dias ainda está na conversa que decide se vira cliente de
 * verdade. Assim nenhum usuário precisa lembrar de marcar ninguém como lead —
 * e nenhum lead fica de fora porque alguém esqueceu.
 */
export function filtroDeLeads(
  desde: Date,
  filtros: Pick<LeadsQuery, 'origem' | 'situacao'> = {},
): Prisma.ClienteWhereInput {
  const where: Prisma.ClienteWhereInput = { ...CLIENTE_ATIVO, criadoEm: { gte: desde } };

  if (filtros.origem) where.origem = filtros.origem;

  switch (filtros.situacao) {
    case 'aguardando':
      Object.assign(where, SEM_NENHUM_CONTATO);
      break;
    case 'em_contato':
      where.orcamentos = { none: {} };
      where.OR = [{ atendimentos: { some: {} } }, { agendamentos: { some: {} } }];
      break;
    case 'com_proposta':
      where.orcamentos = { some: { status: 'aberto' } };
      break;
    case 'ganho':
      where.orcamentos = { some: { status: 'aprovado' } };
      break;
    default:
      break;
  }

  return where;
}

/**
 * Filtro do que é cliente frio.
 *
 * Todas as condições são negativas e todas rodam no banco: nada de atendimento,
 * visita ou proposta recente, e nenhum retorno já marcado. A última é a que
 * mais importa na prática — sugerir ligar para quem já tem follow-up agendado
 * faria a lista perder a confiança de quem a usa no primeiro dia.
 */
export function filtroDeFrios(corte: Date, origem?: string): Prisma.ClienteWhereInput {
  const where: Prisma.ClienteWhereInput = {
    ...CLIENTE_ATIVO,
    criadoEm: { lt: corte },
    atendimentos: { none: { data: { gte: corte } } },
    agendamentos: { none: { dataHora: { gte: corte } } },
    orcamentos: { none: { OR: [{ status: 'aberto' }, { criadoEm: { gte: corte } }] } },
    lembretes: { none: { status: 'pendente' } },
  };

  if (origem) where.origem = origem;

  return where;
}

/**
 * Em que pé está o lead.
 *
 * Deriva do que existe pendurado no cliente, nunca de um campo editável: sem
 * nada é `aguardando`, com atendimento ou visita é `em_contato`, com proposta
 * aberta é `com_proposta`, com proposta aprovada é `ganho`. Assim a situação
 * não tem como mentir — ela é o próprio histórico, lido de outro jeito.
 */
export function situacaoDoLead(
  orcamentos: ReadonlyArray<{ status: string }>,
  houveContato: boolean,
): SituacaoLead {
  if (orcamentos.some((item) => item.status === 'aprovado')) return 'ganho';
  if (orcamentos.some((item) => item.status === 'aberto')) return 'com_proposta';
  if (houveContato) return 'em_contato';

  return 'aguardando';
}

/**
 * Por que o cliente esfriou.
 *
 * A ordem das perguntas é a ordem do valor da ligação: quem já comprou vem
 * antes de quem recusou, e quem recusou vem antes de quem nunca respondeu —
 * nessa sequência quem liga já sabe como abrir a conversa.
 */
export function motivoDoFrio(ultimoStatus: string | undefined, fechados: number): MotivoReativacao {
  if (fechados > 0) return 'comprou_e_sumiu';
  if (ultimoStatus === 'recusado') return 'proposta_recusada';
  if (ultimoStatus) return 'proposta_sem_resposta';

  return 'nunca_fechou';
}

/** O menor instante de uma lista, ignorando os ausentes. */
export function maisAntigo(datas: Array<Date | null | undefined>): Date | null {
  const validas = datas.filter((data): data is Date => data instanceof Date);
  return validas.length === 0
    ? null
    : validas.reduce((menor, data) => (data < menor ? data : menor));
}

/** O maior instante de uma lista, ignorando os ausentes. */
export function maisRecente(datas: Array<Date | null | undefined>): Date | null {
  const validas = datas.filter((data): data is Date => data instanceof Date);
  return validas.length === 0
    ? null
    : validas.reduce((maior, data) => (data > maior ? data : maior));
}
