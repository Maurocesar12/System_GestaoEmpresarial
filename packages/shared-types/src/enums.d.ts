import { z } from 'zod';
/**
 * Enums de domínio.
 *
 * Cada enum é declarado uma vez como const array, derivando dele o schema Zod
 * e o tipo TypeScript. O mesmo conjunto de valores deve ser espelhado nos enums
 * do Prisma — divergência entre os dois é bug de contrato.
 */
/** Papéis de usuário dentro de um tenant (arquitetura §7, §9.5). */
export declare const PAPEIS_USUARIO: readonly ['admin', 'financeiro', 'atendente', 'tecnico'];
export declare const papelUsuarioSchema: z.ZodEnum<{
  admin: 'admin';
  financeiro: 'financeiro';
  atendente: 'atendente';
  tecnico: 'tecnico';
}>;
export type PapelUsuario = z.infer<typeof papelUsuarioSchema>;
/** Ciclo de vida da assinatura de um tenant (arquitetura §6, §8.1). */
export declare const STATUS_TENANT: readonly ['trial', 'ativo', 'suspenso', 'cancelado'];
export declare const statusTenantSchema: z.ZodEnum<{
  trial: 'trial';
  ativo: 'ativo';
  suspenso: 'suspenso';
  cancelado: 'cancelado';
}>;
export type StatusTenant = z.infer<typeof statusTenantSchema>;
/** Status de orçamento. As transições permitidas ainda estão em aberto (§12). */
export declare const STATUS_ORCAMENTO: readonly ['aberto', 'aprovado', 'recusado'];
export declare const statusOrcamentoSchema: z.ZodEnum<{
  aberto: 'aberto';
  aprovado: 'aprovado';
  recusado: 'recusado';
}>;
export type StatusOrcamento = z.infer<typeof statusOrcamentoSchema>;
/** Status de agendamento. Máquina de estados ainda em aberto (§12). */
export declare const STATUS_AGENDAMENTO: readonly [
  'agendado',
  'confirmado',
  'executado',
  'cancelado',
];
export declare const statusAgendamentoSchema: z.ZodEnum<{
  cancelado: 'cancelado';
  agendado: 'agendado';
  confirmado: 'confirmado';
  executado: 'executado';
}>;
export type StatusAgendamento = z.infer<typeof statusAgendamentoSchema>;
/** Canal de envio do lembrete de follow-up. WhatsApp aqui é mensagem *utility*. */
export declare const CANAIS_LEMBRETE: readonly ['email', 'whatsapp'];
export declare const canalLembreteSchema: z.ZodEnum<{
  email: 'email';
  whatsapp: 'whatsapp';
}>;
export type CanalLembrete = z.infer<typeof canalLembreteSchema>;
export declare const STATUS_LEMBRETE: readonly ['pendente', 'enviado', 'falhou', 'cancelado'];
export declare const statusLembreteSchema: z.ZodEnum<{
  cancelado: 'cancelado';
  pendente: 'pendente';
  enviado: 'enviado';
  falhou: 'falhou';
}>;
export type StatusLembrete = z.infer<typeof statusLembreteSchema>;
/** Sentido do lançamento no fluxo de caixa. */
export declare const TIPOS_LANCAMENTO: readonly ['entrada', 'saida'];
export declare const tipoLancamentoSchema: z.ZodEnum<{
  entrada: 'entrada';
  saida: 'saida';
}>;
export type TipoLancamento = z.infer<typeof tipoLancamentoSchema>;
/** Separação pessoal/empresa — exigência do público PME (arquitetura §7). */
export declare const NATUREZAS_LANCAMENTO: readonly ['pessoal', 'empresa'];
export declare const naturezaLancamentoSchema: z.ZodEnum<{
  pessoal: 'pessoal';
  empresa: 'empresa';
}>;
export type NaturezaLancamento = z.infer<typeof naturezaLancamentoSchema>;
/** Classificação usada no cálculo de custo operacional e margem. */
export declare const TIPOS_CUSTO: readonly ['fixo', 'variavel'];
export declare const tipoCustoSchema: z.ZodEnum<{
  fixo: 'fixo';
  variavel: 'variavel';
}>;
export type TipoCusto = z.infer<typeof tipoCustoSchema>;
//# sourceMappingURL=enums.d.ts.map
