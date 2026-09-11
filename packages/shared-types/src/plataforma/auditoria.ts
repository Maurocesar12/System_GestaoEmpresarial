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
  'auditoria',
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

/**
 * Teto de uma exclusão em lote.
 *
 * A remoção roda numa transação só — o que garante que o histórico e o registro
 * da própria exclusão nunca divirjam. Transação longa segura conexão do pool e
 * bloqueia linhas, então o lote tem tamanho máximo: a tela pagina de 30 em 30 e
 * nunca chega perto disso.
 */
export const LIMITE_EXCLUSAO_HISTORICO = 100;

export const exclusaoHistoricoSchema = z.object({
  ids: z
    .array(z.uuid('Histórico inválido.'))
    .min(1, 'Selecione ao menos um histórico para excluir.')
    .max(LIMITE_EXCLUSAO_HISTORICO, `Exclua no máximo ${LIMITE_EXCLUSAO_HISTORICO} por vez.`)
    // Clicar duas vezes na mesma linha não pode contar como dois registros.
    .transform((ids) => [...new Set(ids)]),
});

export type ExclusaoHistoricoInput = z.infer<typeof exclusaoHistoricoSchema>;

/** Quantos registros a exclusão realmente apagou — pode ser menos que o pedido. */
export interface ResultadoExclusaoHistorico {
  removidos: number;
}
