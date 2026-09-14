import type {
  AnalisePrevisaoFinanceira,
  BaseDaPrevisao,
  MensagemChat,
  MesFinanceiro,
  MesProjetado,
} from '@gestao/shared-types';

export interface ContextoPrevisao {
  identificadorSeguro: string;
  saldoAtual: string;
  historico: MesFinanceiro[];
  projecoes: MesProjetado[];
  /**
   * O retrato do negócio além do extrato: propostas, conversão, agenda e
   * compromissos fixos.
   *
   * Sem isso a análise só conseguia falar de médias do passado. É esta parte
   * que permite responder "por que o mês que vem pode ser pior" olhando para o
   * funil, e não para o histórico.
   */
  negocio: BaseDaPrevisao;
}

export interface ResultadoAssistenteIa {
  modo: 'openai' | 'demonstracao';
  modelo: string;
  analise: AnalisePrevisaoFinanceira;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Retrato do negócio para a conversa.
 *
 * Cada bloco é opcional porque o panorama é montado **depois** do filtro de
 * permissões: o que a pessoa não pode ver não chega aqui e, portanto, não entra
 * no que é enviado ao fornecedor de IA.
 */
export interface PanoramaNegocio {
  empresa: string;
  /** Data de hoje em `AAAA-MM-DD`, para o modelo não supor o calendário. */
  hoje: string;
  carteira?: {
    clientes: number;
    leadsSeteDias: number;
    leadsAguardandoContato: number;
    clientesParaReativar: number;
  };
  funil?: {
    clientes: number;
    negociacoesParadas: number;
    etapas: Array<{ etapa: string; clientes: number; valorEmAberto: string }>;
  };
  comercial?: {
    propostasAbertas: number;
    valorEmAberto: string;
    aprovadosNoMes: string;
    recusadosNoMes: string;
    taxaConversaoMes: number;
    ticketMedio: string;
    propostasVencendo: number;
  };
  agenda?: { hoje: number; proximosSeteDias: number; atrasados: number };
  followUps?: { pendentes: number; atrasados: number };
  financeiro?: {
    entradasMes: string;
    saidasMes: string;
    saldoMes: string;
    aReceber: string;
    aPagar: string;
    vencidoAPagar: string;
    vencidoAReceber: string;
    ultimosMeses: Array<{ mes: string; entradas: string; saidas: string; saldo: string }>;
  };
}

export interface ContextoConversa {
  identificadorSeguro: string;
  pergunta: string;
  /** Conversa anterior, do mais antigo ao mais recente. */
  historico: MensagemChat[];
  panorama: PanoramaNegocio;
  /** Papel de quem pergunta, para a resposta falar do que cabe a ele. */
  papel: string;
}

export interface RespostaConversa {
  modo: 'openai' | 'demonstracao';
  modelo: string;
  texto: string;
  sugestoes: string[];
  inputTokens: number;
  outputTokens: number;
}

/** Porta que mantém o domínio independente do fornecedor de IA. */
export abstract class AssistenteIa {
  abstract analisarPrevisao(contexto: ContextoPrevisao): Promise<ResultadoAssistenteIa>;

  /**
   * Responde uma pergunta sobre os números da empresa.
   *
   * Separado de `analisarPrevisao` porque são conversas diferentes: a previsão
   * pede um documento estruturado, sempre com os mesmos campos; o chat pede
   * texto curto, em sequência, sobre o que a pessoa acabou de perguntar.
   */
  abstract conversar(contexto: ContextoConversa): Promise<RespostaConversa>;
}
