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

export const ROTULO_MOVIMENTO_RESERVA: Record<MovimentoReserva, string> = {
  aporte: 'Guardar',
  resgate: 'Resgatar',
};

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
  custoFixoMensal: string;
  mesesDeCobertura: number | null;
}
