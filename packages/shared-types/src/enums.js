'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.tipoCustoSchema =
  exports.TIPOS_CUSTO =
  exports.naturezaLancamentoSchema =
  exports.NATUREZAS_LANCAMENTO =
  exports.tipoLancamentoSchema =
  exports.TIPOS_LANCAMENTO =
  exports.statusLembreteSchema =
  exports.STATUS_LEMBRETE =
  exports.canalLembreteSchema =
  exports.CANAIS_LEMBRETE =
  exports.statusAgendamentoSchema =
  exports.STATUS_AGENDAMENTO =
  exports.statusOrcamentoSchema =
  exports.STATUS_ORCAMENTO =
  exports.statusTenantSchema =
  exports.STATUS_TENANT =
  exports.papelUsuarioSchema =
  exports.PAPEIS_USUARIO =
    void 0;
const zod_1 = require('zod');
/**
 * Enums de domínio.
 *
 * Cada enum é declarado uma vez como const array, derivando dele o schema Zod
 * e o tipo TypeScript. O mesmo conjunto de valores deve ser espelhado nos enums
 * do Prisma — divergência entre os dois é bug de contrato.
 */
// --- Plataforma ---------------------------------------------------------
/** Papéis de usuário dentro de um tenant (arquitetura §7, §9.5). */
exports.PAPEIS_USUARIO = ['admin', 'financeiro', 'atendente', 'tecnico'];
exports.papelUsuarioSchema = zod_1.z.enum(exports.PAPEIS_USUARIO);
/** Ciclo de vida da assinatura de um tenant (arquitetura §6, §8.1). */
exports.STATUS_TENANT = ['trial', 'ativo', 'suspenso', 'cancelado'];
exports.statusTenantSchema = zod_1.z.enum(exports.STATUS_TENANT);
// --- CRM ----------------------------------------------------------------
/** Status de orçamento. As transições permitidas ainda estão em aberto (§12). */
exports.STATUS_ORCAMENTO = ['aberto', 'aprovado', 'recusado'];
exports.statusOrcamentoSchema = zod_1.z.enum(exports.STATUS_ORCAMENTO);
/** Status de agendamento. Máquina de estados ainda em aberto (§12). */
exports.STATUS_AGENDAMENTO = ['agendado', 'confirmado', 'executado', 'cancelado'];
exports.statusAgendamentoSchema = zod_1.z.enum(exports.STATUS_AGENDAMENTO);
/** Canal de envio do lembrete de follow-up. WhatsApp aqui é mensagem *utility*. */
exports.CANAIS_LEMBRETE = ['email', 'whatsapp'];
exports.canalLembreteSchema = zod_1.z.enum(exports.CANAIS_LEMBRETE);
exports.STATUS_LEMBRETE = ['pendente', 'enviado', 'falhou', 'cancelado'];
exports.statusLembreteSchema = zod_1.z.enum(exports.STATUS_LEMBRETE);
// --- Financeiro ---------------------------------------------------------
/** Sentido do lançamento no fluxo de caixa. */
exports.TIPOS_LANCAMENTO = ['entrada', 'saida'];
exports.tipoLancamentoSchema = zod_1.z.enum(exports.TIPOS_LANCAMENTO);
/** Separação pessoal/empresa — exigência do público PME (arquitetura §7). */
exports.NATUREZAS_LANCAMENTO = ['pessoal', 'empresa'];
exports.naturezaLancamentoSchema = zod_1.z.enum(exports.NATUREZAS_LANCAMENTO);
/** Classificação usada no cálculo de custo operacional e margem. */
exports.TIPOS_CUSTO = ['fixo', 'variavel'];
exports.tipoCustoSchema = zod_1.z.enum(exports.TIPOS_CUSTO);
//# sourceMappingURL=enums.js.map
