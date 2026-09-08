import { z } from 'zod';
import { paginacaoQuerySchema } from '../common/paginacao';

export const ACOES_AUDITORIA = [
  'criou',
  'alterou',
  'excluiu',
  'movimentou',
  'convidou',
  'desativou',
] as const;

export const ENTIDADES_AUDITORIA = [
  'cliente',
  'lancamento',
  'pro_labore',
  'reserva',
  'categoria',
  'funil',
  'agendamentos',
  'atendimentos',
  'lembretes',
  'orcamentos',
  'servicos',
  'empresa',
  'funcionario',
  'convite',
  'configuracoes',
  'previsao_financeira',
  'importacao_financeira',
] as const;

export const auditoriaQuerySchema = paginacaoQuerySchema.extend({
  busca: z.string().trim().min(1).max(120).optional(),
  entidade: z.enum(ENTIDADES_AUDITORIA).optional(),
  acao: z.enum(ACOES_AUDITORIA).optional(),
  de: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  ate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type AuditoriaQuery = z.infer<typeof auditoriaQuerySchema>;
export type AcaoAuditoria = (typeof ACOES_AUDITORIA)[number];
export type EntidadeAuditoria = (typeof ENTIDADES_AUDITORIA)[number];

export interface RegistroAuditoria {
  id: string;
  usuarioId: string | null;
  usuarioNome: string;
  entidade: EntidadeAuditoria | string;
  entidadeId: string;
  acao: AcaoAuditoria | string;
  resumo: string;
  antes: unknown;
  depois: unknown;
  criadoEm: string;
}
