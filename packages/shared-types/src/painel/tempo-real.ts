import type { AcaoAuditoria, EntidadeAuditoria } from '../plataforma/auditoria';
import type { MotivoReativacao, SituacaoLead } from '../crm/leads';

/**
 * Contrato do painel em tempo real.
 *
 * ## Por que um endpoint só
 *
 * A tela inicial buscava doze coisas em doze requisições. Funcionava para uma
 * carga por sessão; não funciona para uma tela que se atualiza sozinha a cada
 * meio minuto — seriam doze idas à API por ciclo, cada uma abrindo a própria
 * transação, e um número lido do banco às 10h00m02s ao lado de outro lido às
 * 10h00m05s. Aqui tudo sai de **uma transação**, então o painel inteiro mostra
 * o mesmo instante, carimbado em `geradoEm`.
 *
 * ## Por que os blocos são anuláveis
 *
 * O painel é a primeira tela de todo mundo, inclusive de quem não pode ver
 * dinheiro (§9.5). Em vez de esconder na tela o que a API já mandou — o que
 * deixaria o dado trafegando para quem não devia recebê-lo —, cada bloco vem
 * `null` quando falta permissão, e a tela simplesmente não o desenha.
 */

/** Um lead recém-chegado, como o painel o mostra. */
export interface LeadDoPainel {
  id: string;
  nome: string;
  origem: string | null;
  criadoEm: string;
  situacao: SituacaoLead;
  horasAteContato: number;
}

export interface BlocoLeads {
  hoje: number;
  ontem: number;
  seteDias: number;
  aguardandoContato: number;
  /** Aguardando além do prazo de resposta. É o que vira alerta. */
  semContatoNoPrazo: number;
  valorEmProposta: string;
  porOrigem: Array<{ origem: string; total: number }>;
  ultimos: LeadDoPainel[];
}

export interface ColunaDoPainel {
  id: string;
  nome: string;
  clientes: number;
  /** Soma das propostas abertas dos clientes desta etapa. */
  valor: string;
}

export interface NegociacaoParada {
  clienteId: string;
  nome: string;
  etapa: string;
  dias: number;
  valor: string | null;
}

export interface BlocoFunil {
  total: number;
  foraDoFunil: number;
  etapas: ColunaDoPainel[];
  paradas: NegociacaoParada[];
}

export interface PropostaVencendo {
  id: string;
  clienteNome: string;
  valor: string;
  validoAte: string;
  /** Negativo quando já venceu. */
  diasRestantes: number;
}

export interface BlocoComercial {
  abertos: { quantidade: number; valor: string };
  aprovadosMes: { quantidade: number; valor: string };
  recusadosMes: { quantidade: number; valor: string };
  /** Aprovados sobre respondidos no mês, de 0 a 1. */
  taxaConversaoMes: number;
  ticketMedio: string;
  vencendo: PropostaVencendo[];
}

export interface CompromissoDoPainel {
  id: string;
  clienteNome: string;
  servicoNome: string | null;
  dataHora: string;
  status: string;
}

export interface BlocoAgenda {
  hoje: CompromissoDoPainel[];
  /** Passaram da hora e continuam agendados ou confirmados. */
  atrasados: number;
  amanha: number;
  seteDias: number;
}

export interface FollowUpDoPainel {
  id: string;
  clienteId: string;
  clienteNome: string;
  canal: string;
  dataEnvio: string;
}

export interface BlocoFollowUps {
  pendentes: number;
  atrasados: number;
  /** Falharam nos últimos sete dias — costuma ser e-mail inválido. */
  falhasRecentes: number;
  proximos: FollowUpDoPainel[];
}

export interface ClienteFrioDoPainel {
  id: string;
  nome: string;
  motivo: MotivoReativacao;
  diasSemContato: number;
  valorHistorico: string;
}

export interface BlocoReativacao {
  total: number;
  valorHistorico: string;
  principais: ClienteFrioDoPainel[];
}

export interface BlocoFinanceiro {
  entradasMes: string;
  saidasMes: string;
  saldoMes: string;
  aReceber: string;
  aPagar: string;
  /**
   * Em aberto com vencimento no passado, separados por sentido.
   *
   * Separados porque exigem ações opostas: conta a pagar vencida é multa
   * correndo, conta a receber vencida é cobrança a fazer. Somadas num número só,
   * a única leitura possível seria "tem algo errado".
   */
  vencidosAPagar: { quantidade: number; valor: string };
  vencidosAReceber: { quantidade: number; valor: string };
  /** Últimos seis meses, do mais antigo ao mais recente. */
  serie: Array<{ mes: string; entradas: string; saidas: string; saldo: string }>;
}

export interface EventoDoPainel {
  id: string;
  quando: string;
  usuarioNome: string;
  acao: AcaoAuditoria | string;
  entidade: EntidadeAuditoria | string;
  entidadeId: string;
  resumo: string;
}

/**
 * O que precisa de alguém agora.
 *
 * Calculado no servidor porque é regra de negócio, não enfeite de tela: o corte
 * de "parado demais", "vencendo" e "atrasado" precisa ser o mesmo para todo
 * mundo, e a tela não deveria reimplementá-lo para pintar um cartão.
 */
export type TomAlerta = 'perigo' | 'atencao' | 'info';

export interface AlertaDoPainel {
  id: string;
  tom: TomAlerta;
  titulo: string;
  detalhe: string;
  href: string;
}

export interface PainelTempoReal {
  /** Instante em que o servidor leu tudo. A tela mostra e conta a partir dele. */
  geradoEm: string;
  /** De quanto em quanto tempo a tela deve se atualizar sozinha. */
  recarregarEmSegundos: number;
  alertas: AlertaDoPainel[];
  /** Total de clientes na carteira. Zero significa empresa recém-criada. */
  totalClientes: number;
  leads: BlocoLeads | null;
  funil: BlocoFunil | null;
  comercial: BlocoComercial | null;
  agenda: BlocoAgenda | null;
  followUps: BlocoFollowUps | null;
  reativacao: BlocoReativacao | null;
  financeiro: BlocoFinanceiro | null;
  atividade: EventoDoPainel[];
}

/**
 * Intervalo padrão de atualização do painel.
 *
 * Trinta segundos é o ponto em que a tela parece viva sem virar carga: uma
 * empresa com dez pessoas de painel aberto gera vinte requisições por minuto,
 * o que qualquer instância aguenta. Abaixo disso o ganho é imperceptível para
 * quem olha, e o custo cresce linearmente.
 */
export const SEGUNDOS_RECARGA_PAINEL = 30;
