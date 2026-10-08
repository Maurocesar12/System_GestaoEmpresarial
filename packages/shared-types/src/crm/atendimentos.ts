import { z } from 'zod';

/**
 * Contrato de atendimentos (arquitetura §7).
 *
 * O atendimento é o registro do que aconteceu com um cliente: a visita, a
 * ligação, o serviço executado. É o "histórico" que o CRM promete substituir do
 * caderno e do WhatsApp.
 *
 * Diferente de orçamento e agendamento, que descrevem o que **vai** acontecer,
 * o atendimento descreve o que **já** aconteceu. Por isso não tem status nem
 * máquina de estados — é um fato registrado.
 */

export const atendimentoFormSchema = z.object({
  descricao: z.string().trim().min(3, 'Descreva o que foi feito').max(2000),

  /**
   * Data do atendimento, no formato AAAA-MM-DD.
   *
   * Data pura, sem hora: quem registra "fui lá ontem" não lembra do horário, e
   * um campo de hora obrigatório só criaria atrito para um dado que ninguém
   * consultaria depois.
   */
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
});

export type AtendimentoFormInput = z.infer<typeof atendimentoFormSchema>;

export interface Atendimento {
  id: string;
  clienteId: string;
  descricao: string;
  data: string;
  criadoEm: string;
}
