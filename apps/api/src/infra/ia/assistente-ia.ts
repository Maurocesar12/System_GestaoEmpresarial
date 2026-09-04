import type { AnalisePrevisaoFinanceira, MesFinanceiro, MesProjetado } from '@gestao/shared-types';

export interface ContextoPrevisao {
  identificadorSeguro: string;
  saldoAtual: string;
  historico: MesFinanceiro[];
  projecoes: MesProjetado[];
}

export interface ResultadoAssistenteIa {
  modo: 'openai' | 'demonstracao';
  modelo: string;
  analise: AnalisePrevisaoFinanceira;
  inputTokens: number;
  outputTokens: number;
}

/** Porta que mantém o domínio independente do fornecedor de IA. */
export abstract class AssistenteIa {
  abstract analisarPrevisao(contexto: ContextoPrevisao): Promise<ResultadoAssistenteIa>;
}
