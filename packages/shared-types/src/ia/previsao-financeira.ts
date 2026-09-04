import { z } from 'zod';

export const gerarPrevisaoFinanceiraSchema = z.object({
  mesesHistorico: z.number().int().min(3).max(12).default(6),
  mesesProjecao: z.number().int().min(1).max(6).default(3),
});

export type GerarPrevisaoFinanceiraInput = z.infer<typeof gerarPrevisaoFinanceiraSchema>;

export interface MesFinanceiro {
  mes: string;
  entradas: string;
  saidas: string;
  saldo: string;
}

export interface MesProjetado extends MesFinanceiro {
  saldoAcumulado: string;
  contasAReceberConhecidas: string;
  contasAPagarConhecidas: string;
}

export interface AnalisePrevisaoFinanceira {
  resumo: string;
  nivelRisco: 'baixo' | 'moderado' | 'alto';
  pontosAtencao: string[];
  acoesRecomendadas: string[];
  avisos: string[];
}

export interface PrevisaoFinanceiraResponse {
  id: string;
  geradoEm: string;
  modo: 'openai' | 'demonstracao';
  modelo: string;
  aviso: string;
  historico: MesFinanceiro[];
  projecoes: MesProjetado[];
  analise: AnalisePrevisaoFinanceira;
  consumo: {
    inputTokens: number;
    outputTokens: number;
    custoEstimadoUsd: string;
  };
  quota: {
    usado: number;
    limite: number | null;
  };
}

export interface ConsumoIaResponse {
  periodo: string;
  totalPrevisoes: number;
  inputTokens: number;
  outputTokens: number;
  custoEstimadoUsd: string;
  porUsuario: Array<{
    usuarioId: string;
    usuarioNome: string;
    previsoes: number;
    inputTokens: number;
    outputTokens: number;
    custoEstimadoUsd: string;
  }>;
}
