import { z } from 'zod';

/**
 * Contrato da previsão financeira.
 *
 * A previsão é recurso do plano Premium. Ela deixou de existir em versão
 * gratuita limitada porque a versão gratuita não previa nada: repetia a média
 * dos últimos meses com um texto montado por regras, e quem a usava saía
 * achando que tinha uma projeção quando tinha uma média. Melhor não oferecer do
 * que oferecer uma resposta em que não se pode confiar para decidir.
 */

export const PACOTE_IA_PRECO_MENSAL_BRL = '200,00';
export const PACOTE_IA_PREVISOES_MENSAIS = 200;

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
  /**
   * Receita provável vinda do funil: propostas em aberto ponderadas pela taxa
   * de conversão da própria empresa.
   *
   * Entra separada das contas a receber porque não é a mesma coisa — uma é
   * dinheiro combinado, a outra é dinheiro possível. Somar as duas na mesma
   * linha esconderia exatamente a diferença que muda uma decisão.
   */
  receitaProvavelFunil: string;
  /** Pró-labore vigente: a retirada que se repete todo mês, registrada ou não. */
  compromissosRecorrentes: string;
}

export interface AnalisePrevisaoFinanceira {
  resumo: string;
  nivelRisco: 'baixo' | 'moderado' | 'alto';
  pontosAtencao: string[];
  acoesRecomendadas: string[];
  avisos: string[];
  /**
   * Leitura dos três desfechos plausíveis.
   *
   * Opcional porque previsões geradas antes desta versão continuam no banco em
   * JSON, e a tela precisa conseguir exibi-las sem quebrar.
   */
  cenarios?: {
    pessimista: string;
    base: string;
    otimista: string;
  };
  /** Onde existe dinheiro a ganhar — sai do funil e da carteira, não do caixa. */
  oportunidades?: string[];
}

/**
 * O que entrou na conta.
 *
 * Previsão sem procedência vira adivinhação: quem lê precisa saber se os
 * números consideraram as propostas em aberto, os agendamentos do mês que vem e
 * as contas vencidas — ou se olharam só para o extrato. Também é o que permite
 * responder "por que a projeção mudou?" sem abrir o código.
 */
export interface BaseDaPrevisao {
  mesesHistorico: number;
  mesesProjecao: number;
  lancamentosAnalisados: number;
  clientesNaCarteira: number;
  propostasAbertas: { quantidade: number; valor: string };
  /** Aprovados sobre respondidos no histórico analisado, de 0 a 1. */
  taxaConversao: number;
  ticketMedio: string;
  agendamentosFuturos: number;
  /** Pró-labore mensal vigente. */
  compromissosRecorrentes: string;
  contasVencidas: { quantidade: number; valor: string };
  /** As maiores saídas por categoria no histórico, já ordenadas. */
  maioresSaidas: Array<{ categoria: string; valor: string }>;
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
  /** Ausente nas previsões geradas antes desta versão. */
  baseDeDados?: BaseDaPrevisao;
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
