import { z } from 'zod';
import { paginacaoQuerySchema, type PaginacaoMeta } from '../common/paginacao';

/**
 * Contrato da entrada de leads e da lista de reativação.
 *
 * O CRM já guardava tudo que estas duas telas precisam — cliente, origem,
 * atendimento, orçamento, agendamento — mas não existia lugar nenhum que
 * respondesse as duas perguntas que um comercial faz todo dia:
 *
 * 1. **Quem chegou e ainda não foi atendido?** Um lead cadastrado às 9h que
 *    ninguém abriu até as 17h é dinheiro esfriando em silêncio. A listagem de
 *    clientes ordena por nome e não distingue quem chegou hoje de quem está na
 *    carteira há dois anos.
 *
 * 2. **Quem já foi cliente e sumiu?** É a venda mais barata que existe — e a
 *    que ninguém lembra de fazer, porque o cliente frio não aparece em tela
 *    nenhuma: ele não tem orçamento aberto, não tem agendamento e não tem
 *    lembrete pendente. Justamente por isso some.
 *
 * Nada aqui é entidade nova no banco. As duas listas são **leituras** sobre o
 * que já existe, o que evita mais um cadastro para alguém manter atualizado —
 * lista de reativação mantida à mão é lista que envelhece na primeira semana.
 */

// --- Entrada de leads ------------------------------------------------------

/**
 * Janela padrão, em dias, do que conta como "lead que chegou".
 *
 * Trinta dias cobre o ciclo de venda típico de serviço para PME sem transformar
 * a tela num relatório histórico. É só o padrão: a tela permite outras janelas.
 */
export const DIAS_LEAD_RECENTE = 30;

/**
 * Horas sem ninguém encostar no lead a partir das quais ele vira alerta.
 *
 * Lead novo responde melhor quanto antes o contato acontece, e 24h é o corte
 * que a operação consegue perseguir de verdade — um corte de 1h viraria um
 * painel permanentemente vermelho, que as pessoas aprendem a ignorar.
 */
export const HORAS_LEAD_SEM_CONTATO = 24;

/**
 * Em que pé está o lead.
 *
 * Deriva do que existe pendurado no cliente, e não de um campo que alguém
 * precise manter: sem nada é `aguardando`, com atendimento ou agendamento é
 * `em_contato`, com proposta aberta é `com_proposta`, com proposta aprovada é
 * `ganho`. Assim a situação nunca mente — ela é o próprio histórico.
 */
export const SITUACOES_LEAD = ['aguardando', 'em_contato', 'com_proposta', 'ganho'] as const;
export const situacaoLeadSchema = z.enum(SITUACOES_LEAD);
export type SituacaoLead = z.infer<typeof situacaoLeadSchema>;

export const ROTULO_SITUACAO_LEAD: Record<SituacaoLead, string> = {
  aguardando: 'Aguardando contato',
  em_contato: 'Em contato',
  com_proposta: 'Proposta enviada',
  ganho: 'Fechado',
};

export const leadsQuerySchema = paginacaoQuerySchema.extend({
  /** Tamanho da janela de chegada, em dias. */
  dias: z.coerce.number().int().min(1).max(365).default(DIAS_LEAD_RECENTE),
  origem: z.string().trim().max(60).optional(),
  situacao: situacaoLeadSchema.optional(),
});

export type LeadsQuery = z.infer<typeof leadsQuerySchema>;

/** Um lead na fila de entrada. */
export interface Lead {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  origem: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  /** Quando o lead entrou na base. É o relógio que a fila de entrada mede. */
  criadoEm: string;
  situacao: SituacaoLead;
  etapaFunil: { id: string; nome: string } | null;
  etiquetas: Array<{ id: string; nome: string; cor: string }>;
  /**
   * Último toque registrado: atendimento, agendamento ou orçamento.
   * `null` quando ninguém encostou no lead desde que ele chegou.
   */
  primeiroContatoEm: string | null;
  /** Horas entre a chegada e o primeiro toque — ou até agora, se não houve. */
  horasAteContato: number;
  /** Proposta em aberto, quando existe. */
  orcamentoAberto: { id: string; valor: string } | null;
  /** Follow-up já marcado, para a tela não sugerir marcar de novo. */
  lembretePendenteEm: string | null;
}

/** Contagens da fila de entrada, para o cabeçalho da tela e o painel. */
export interface ResumoLeads {
  /** Janela usada no cálculo, em dias. */
  dias: number;
  hoje: number;
  ontem: number;
  seteDias: number;
  noPeriodo: number;
  aguardandoContato: number;
  /** Aguardando há mais de `HORAS_LEAD_SEM_CONTATO`. É o número que dói. */
  semContatoNoPrazo: number;
  comProposta: number;
  ganhos: number;
  valorEmProposta: string;
  /** Ganhos sobre o total do período, de 0 a 1. */
  taxaConversao: number;
  porOrigem: Array<{ origem: string; total: number }>;
}

/**
 * A tela inteira numa resposta: o resumo do topo, a página da lista e a
 * paginação. Separar em duas rotas faria a tela pedir duas vezes o mesmo
 * recorte e correr o risco de mostrar um resumo de um instante com uma lista de
 * outro.
 */
export interface EntradaDeLeads {
  resumo: ResumoLeads;
  leads: Lead[];
  meta: PaginacaoMeta;
}

// --- Reativação ------------------------------------------------------------

/**
 * Dias sem nenhum toque a partir dos quais o cliente entra na lista de
 * reativação.
 *
 * Sessenta dias é o corte que separa "está quieto" de "esfriou" para serviço
 * recorrente de PME. Também é ajustável na tela — quem vende algo anual quer
 * 180, quem vende manutenção mensal quer 45.
 */
export const DIAS_PARA_REATIVACAO = 60;

/**
 * Teto de candidatos analisados por consulta.
 *
 * A lista de reativação é **fila de trabalho**, não relatório: ninguém liga
 * para mil clientes nesta semana. Ranquear os mais antigos e mostrar os
 * melhores primeiro entrega a ligação que vale a pena hoje; o relatório
 * completo continua sendo a listagem de clientes, que pagina no banco.
 */
export const LIMITE_ANALISE_REATIVACAO = 300;

/**
 * Por que o cliente está na lista.
 *
 * O motivo muda a abordagem da ligação, e é por isso que ele viaja junto:
 * quem recusou uma proposta merece outro preço, quem comprou e sumiu merece
 * "está na hora da revisão", e quem nunca fechou merece uma pergunta honesta
 * sobre o que faltou.
 */
export const MOTIVOS_REATIVACAO = [
  'comprou_e_sumiu',
  'proposta_recusada',
  'proposta_sem_resposta',
  'nunca_fechou',
] as const;
export const motivoReativacaoSchema = z.enum(MOTIVOS_REATIVACAO);
export type MotivoReativacao = z.infer<typeof motivoReativacaoSchema>;

export const ROTULO_MOTIVO_REATIVACAO: Record<MotivoReativacao, string> = {
  comprou_e_sumiu: 'Comprou e sumiu',
  proposta_recusada: 'Recusou a proposta',
  proposta_sem_resposta: 'Proposta sem resposta',
  nunca_fechou: 'Nunca fechou',
};

/** Como abrir a conversa com cada tipo de cliente frio. */
export const SUGESTAO_MOTIVO_REATIVACAO: Record<MotivoReativacao, string> = {
  comprou_e_sumiu: 'Já comprou de você. Ofereça a revisão, a manutenção ou o próximo serviço.',
  proposta_recusada: 'Recusou o valor ou o prazo. Uma condição nova costuma reabrir a conversa.',
  proposta_sem_resposta: 'A proposta ficou sem resposta. Pergunte o que faltou antes de reenviar.',
  nunca_fechou: 'Entrou na base e não avançou. Confirme se a necessidade ainda existe.',
};

export const reativacaoQuerySchema = paginacaoQuerySchema.extend({
  /** Dias sem contato a partir dos quais o cliente entra na lista. */
  dias: z.coerce.number().int().min(7).max(1095).default(DIAS_PARA_REATIVACAO),
  motivo: motivoReativacaoSchema.optional(),
  origem: z.string().trim().max(60).optional(),
});

export type ReativacaoQuery = z.infer<typeof reativacaoQuerySchema>;

/** Um cliente frio, pronto para a ligação. */
export interface ClienteParaReativar {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  origem: string | null;
  motivo: MotivoReativacao;
  /** Último toque de qualquer tipo. `null` quando nunca houve nenhum. */
  ultimoContatoEm: string | null;
  diasSemContato: number;
  /** Soma dos orçamentos aprovados. É o que ordena a fila. */
  valorHistorico: string;
  /** Quantos serviços já fechou. Zero também é informação. */
  servicosFechados: number;
  ultimoOrcamento: {
    id: string;
    valor: string;
    status: string;
    criadoEm: string;
    servicoNome: string | null;
  } | null;
  etapaFunil: { id: string; nome: string } | null;
}

export interface ResumoReativacao {
  dias: number;
  /** Candidatos encontrados no banco, mesmo além do teto de análise. */
  total: number;
  /** Quantos foram efetivamente ranqueados nesta consulta. */
  analisados: number;
  /** Soma do histórico aprovado dos analisados: o tamanho da oportunidade. */
  valorHistorico: string;
  porMotivo: Array<{ motivo: MotivoReativacao; total: number }>;
}

export interface ListaDeReativacao {
  resumo: ResumoReativacao;
  clientes: ClienteParaReativar[];
  meta: PaginacaoMeta;
}

/** Horas decorridas desde um instante ISO, nunca negativas. */
export function horasDesde(iso: string): number {
  const MS_POR_HORA = 60 * 60 * 1000;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / MS_POR_HORA));
}

/**
 * "há 3 h", "há 5 dias" — o tempo como alguém fala dele.
 *
 * Fica no contrato, e não na tela, porque a API também precisa da mesma frase
 * ao montar os alertas do painel. Duas implementações divergiriam no primeiro
 * ajuste de arredondamento.
 */
export function formatarEspera(horas: number): string {
  if (horas < 1) return 'agora há pouco';
  if (horas < 24) return `há ${horas} h`;

  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}
