import { z } from 'zod';
import { paginacaoQuerySchema } from '../common/paginacao';
import {
  canalLembreteSchema,
  statusLembreteSchema,
  type CanalLembrete,
  type StatusLembrete,
} from '../enums';

/**
 * Contrato de lembretes de follow-up.
 *
 * Nesta primeira fatia, o lembrete é criado manualmente e fica pendente para a
 * futura fila BullMQ processar. Isso entrega a base do domínio sem acoplar o
 * deploy a Redis antes de existir worker de envio.
 */
export const lembreteFormSchema = z.object({
  clienteId: z.uuid('Selecione o cliente'),
  canal: canalLembreteSchema,
  dataEnvio: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, 'Informe data e hora'),
});

export type LembreteFormInput = z.infer<typeof lembreteFormSchema>;
export type LembreteFormEntrada = z.input<typeof lembreteFormSchema>;

export const lembretesQuerySchema = paginacaoQuerySchema.extend({
  status: statusLembreteSchema.optional(),
  canal: canalLembreteSchema.optional(),
  clienteId: z.uuid().optional(),
  de: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  ate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type LembretesQuery = z.infer<typeof lembretesQuerySchema>;

export const ROTULO_CANAL_LEMBRETE: Record<CanalLembrete, string> = {
  email: 'E-mail',
  whatsapp: 'WhatsApp',
};

export const ROTULO_STATUS_LEMBRETE: Record<StatusLembrete, string> = {
  pendente: 'Pendente',
  enviado: 'Enviado',
  falhou: 'Falhou',
  cancelado: 'Cancelado',
};

export interface LembreteFollowUp {
  id: string;
  clienteId: string;
  clienteNome: string;
  clienteEmail: string | null;
  clienteTelefone: string | null;
  canal: CanalLembrete;
  status: StatusLembrete;
  /** ISO completo, com hora. */
  dataEnvio: string;
  enviadoEm: string | null;
  erro: string | null;
  criadoEm: string;
}
