import { z } from 'zod';
import { dinheiroDigitadoSchema } from '../common/dinheiro';

/**
 * Pró-labore: a retirada mensal do dono (arquitetura §7).
 *
 * ## Por que histórico com vigência, e não um campo só
 *
 * Guardar "o pró-labore é R$ 5.000" numa coluna faria o passado mudar toda vez
 * que o dono reajustasse a retirada — o relatório de março passaria a usar o
 * valor definido em agosto. Com vigência, cada mês é calculado com o valor que
 * valia naquele mês.
 *
 * A vigência em aberto (`vigenciaFim: null`) é o valor atual. Definir um novo
 * não apaga o anterior: fecha a vigência dele no dia anterior e abre outra.
 */

export const proLaboreFormSchema = z.object({
  valor: dinheiroDigitadoSchema,

  /** A partir de quando este valor vale, `AAAA-MM-DD`. */
  vigenciaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
});

export type ProLaboreFormInput = z.infer<typeof proLaboreFormSchema>;
export type ProLaboreFormEntrada = z.input<typeof proLaboreFormSchema>;

export interface ProLabore {
  id: string;
  /** String decimal — nunca `number`, para não perder centavos. */
  valor: string;
  vigenciaInicio: string;
  /** `null` significa vigência em aberto: é o valor atual. */
  vigenciaFim: string | null;
  criadoEm: string;
}

/**
 * Quanto o dono pode retirar sem descapitalizar a empresa.
 *
 * ## A fórmula, e por que ela é conservadora
 *
 * ```
 *   teto = média das entradas recebidas nos últimos N meses
 *        − custo fixo mensal médio
 *        − custo variável mensal médio
 *        − aporte sugerido para a reserva
 * ```
 *
 * Usa **entradas recebidas** (`pagoEm`), não faturadas: dinheiro que ainda não
 * caiu não paga conta nenhuma. E desconta o aporte de reserva antes de mostrar
 * o teto — um teto que ignora a reserva é exatamente como o dono descapitaliza
 * a empresa achando que está no azul.
 *
 * A média de vários meses existe porque faturamento de PME de serviço oscila:
 * calcular o teto sobre um mês bom levaria a uma retirada que o mês seguinte
 * não sustenta.
 */
export interface SugestaoProLabore {
  /** O que está definido hoje. `null` se o dono nunca definiu. */
  valorVigente: string | null;

  /** Média mensal das entradas efetivamente recebidas no intervalo analisado. */
  mediaReceita: string;
  custoFixoMensal: string;
  custoVariavelMensal: string;

  /** Quanto guardar por mês para a reserva chegar à meta. Zero se não há meta. */
  aporteReservaSugerido: string;

  /** O teto da fórmula acima. Nunca negativo — o piso é zero. */
  tetoSugerido: string;

  /**
   * `tetoSugerido − valorVigente`. Negativo significa que a retirada atual está
   * acima do que o negócio sustenta.
   */
  folga: string;

  /** Quantos meses entraram na média. Menos de 3 torna a sugestão frágil. */
  mesesAnalisados: number;
}

export const sugestaoQuerySchema = z.object({
  /** Quantos meses entram na média. Três é o padrão: absorve oscilação sem envelhecer. */
  meses: z.coerce.number().int().min(1).max(24).default(3),
});

export type SugestaoQuery = z.infer<typeof sugestaoQuerySchema>;
