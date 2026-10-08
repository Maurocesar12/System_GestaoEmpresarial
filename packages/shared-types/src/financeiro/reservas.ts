import { z } from 'zod';
import { dinheiroDigitadoSchema } from '../common/dinheiro';
import { opcional } from '../common/opcional';

/**
 * Reserva financeira — o fundo de emergência da empresa (arquitetura §7).
 *
 * Responde a pergunta que o dono de PME de serviço evita fazer: *se eu ficar
 * três meses sem faturar, eu sobrevivo?*
 *
 * O número guardado é um saldo, mas o número que importa é derivado dele:
 * quantos meses de custo fixo aquela reserva cobre. "R$ 18.000" não diz nada
 * sozinho; "cobre 2,4 meses de custo fixo" diz tudo.
 */

export const reservaFormSchema = z.object({
  nome: z.string().trim().min(2, 'Dê um nome à reserva').max(60),

  valorAtual: dinheiroDigitadoSchema,

  /** Quanto se pretende acumular. Vazio significa reserva sem alvo definido. */
  meta: opcional(dinheiroDigitadoSchema),
});

export type ReservaFormInput = z.infer<typeof reservaFormSchema>;
export type ReservaFormEntrada = z.input<typeof reservaFormSchema>;

/** Aporte ou resgate. Move o saldo sem exigir que o usuário calcule o novo total. */
export const MOVIMENTOS_RESERVA = ['aporte', 'resgate'] as const;
export const movimentoReservaSchema = z.enum(MOVIMENTOS_RESERVA);
export type MovimentoReserva = z.infer<typeof movimentoReservaSchema>;

export const movimentacaoFormSchema = z.object({
  tipo: movimentoReservaSchema,
  valor: dinheiroDigitadoSchema,
});

export type MovimentacaoFormInput = z.infer<typeof movimentacaoFormSchema>;
export type MovimentacaoFormEntrada = z.input<typeof movimentacaoFormSchema>;

export interface Reserva {
  id: string;
  nome: string;
  /** String decimal — nunca `number`, para não perder centavos. */
  valorAtual: string;
  meta: string | null;

  /**
   * `valorAtual ÷ meta`, de 0 a 100. `null` quando não há meta.
   *
   * Calculado pela API e não pela tela para que a barra de progresso e qualquer
   * outro consumidor cheguem ao mesmo número.
   */
  percentualDaMeta: number | null;

  /**
   * O aporte mensal que a simulação sugere de partida: o que falta para a
   * meta dividido em 12 meses, ou R$ 500 sem meta. Calculado pela API.
   */
  aporteSugerido: string;

  criadoEm: string;
  atualizadoEm: string;
}

/**
 * O panorama das reservas, com a leitura que interessa.
 *
 * `mesesDeCobertura` é o número que transforma um saldo em resposta: quanto
 * tempo a empresa aguenta parada. Vem `null` quando não há custo fixo
 * registrado no período — dividir por zero não é "cobertura infinita", é
 * pergunta sem resposta.
 */
export interface ResumoReservas {
  reservas: Reserva[];
  totalGuardado: string;
  totalDasMetas: string;
  /** Quanto falta para todas as metas juntas. Nunca negativo. */
  faltaParaMetas: string;
  custoFixoMensal: string;
  mesesDeCobertura: number | null;
}

/**
 * "Se eu guardar X por mês durante N meses, onde chego?"
 *
 * A conta era feita na tela. Agora a API faz, com o saldo, a meta e o custo
 * fixo lidos do banco — e não os números que a tela tinha na mão.
 */
export const simulacaoReservaSchema = z.object({
  aporteMensal: dinheiroDigitadoSchema,
  meses: z.coerce.number().int().min(1, 'Ao menos 1 mês').max(120, 'No máximo 120 meses'),
});

export type SimulacaoReservaInput = z.infer<typeof simulacaoReservaSchema>;

export interface SimulacaoReserva {
  totalAportado: string;
  saldoPrevisto: string;
  /** `null` sem meta. "0.00" quando a meta é alcançada no período. */
  faltaParaMeta: string | null;
  /** No ritmo informado, quantos meses até a meta. `null` sem meta ou sem aporte. */
  mesesParaMeta: number | null;
  /** Quantos meses de custo fixo o saldo previsto cobre. `null` sem custo fixo. */
  mesesDeCobertura: number | null;
}
