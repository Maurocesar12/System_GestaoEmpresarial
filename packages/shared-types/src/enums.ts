import { z } from 'zod';

/**
 * Enums de domínio.
 *
 * Cada enum é declarado uma vez como const array, derivando dele o schema Zod
 * e o tipo TypeScript. O mesmo conjunto de valores deve ser espelhado nos enums
 * do Prisma — divergência entre os dois é bug de contrato.
 */

// --- Plataforma ---------------------------------------------------------

/** Papéis de usuário dentro de um tenant (arquitetura §7, §9.5). */
export const PAPEIS_USUARIO = ['admin', 'financeiro', 'atendente', 'tecnico'] as const;
export const papelUsuarioSchema = z.enum(PAPEIS_USUARIO);
export type PapelUsuario = z.infer<typeof papelUsuarioSchema>;

/** Ciclo de vida da assinatura de um tenant (arquitetura §6, §8.1). */
export const STATUS_TENANT = ['trial', 'ativo', 'suspenso', 'cancelado'] as const;
export const statusTenantSchema = z.enum(STATUS_TENANT);
export type StatusTenant = z.infer<typeof statusTenantSchema>;

// --- CRM ----------------------------------------------------------------

/** Status de orçamento. As transições permitidas ainda estão em aberto (§12). */
export const STATUS_ORCAMENTO = ['aberto', 'aprovado', 'recusado'] as const;
export const statusOrcamentoSchema = z.enum(STATUS_ORCAMENTO);
export type StatusOrcamento = z.infer<typeof statusOrcamentoSchema>;

/** Status de agendamento. Máquina de estados ainda em aberto (§12). */
export const STATUS_AGENDAMENTO = ['agendado', 'confirmado', 'executado', 'cancelado'] as const;
export const statusAgendamentoSchema = z.enum(STATUS_AGENDAMENTO);
export type StatusAgendamento = z.infer<typeof statusAgendamentoSchema>;

/** Canal de envio do lembrete de follow-up. WhatsApp aqui é mensagem *utility*. */
export const CANAIS_LEMBRETE = ['email', 'whatsapp'] as const;
export const canalLembreteSchema = z.enum(CANAIS_LEMBRETE);
export type CanalLembrete = z.infer<typeof canalLembreteSchema>;

export const STATUS_LEMBRETE = ['pendente', 'enviado', 'falhou', 'cancelado'] as const;
export const statusLembreteSchema = z.enum(STATUS_LEMBRETE);
export type StatusLembrete = z.infer<typeof statusLembreteSchema>;

// --- Financeiro ---------------------------------------------------------

/** Sentido do lançamento no fluxo de caixa. */
export const TIPOS_LANCAMENTO = ['entrada', 'saida'] as const;
export const tipoLancamentoSchema = z.enum(TIPOS_LANCAMENTO);
export type TipoLancamento = z.infer<typeof tipoLancamentoSchema>;

/** Separação pessoal/empresa — exigência do público PME (arquitetura §7). */
export const NATUREZAS_LANCAMENTO = ['pessoal', 'empresa'] as const;
export const naturezaLancamentoSchema = z.enum(NATUREZAS_LANCAMENTO);
export type NaturezaLancamento = z.infer<typeof naturezaLancamentoSchema>;

/** Classificação usada no cálculo de custo operacional e margem. */
export const TIPOS_CUSTO = ['fixo', 'variavel'] as const;
export const tipoCustoSchema = z.enum(TIPOS_CUSTO);
export type TipoCusto = z.infer<typeof tipoCustoSchema>;
