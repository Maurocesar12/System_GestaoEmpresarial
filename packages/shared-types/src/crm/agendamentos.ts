import { z } from 'zod';
import { opcional, textoOpcional } from '../common/opcional';
import { paginacaoQuerySchema } from '../common/paginacao';
import { statusAgendamentoSchema, type StatusAgendamento } from '../enums';

/**
 * Contrato de agendamentos (arquitetura §7).
 *
 * O agendamento é o compromisso: o serviço marcado para uma data e hora. Fecha
 * o ciclo do CRM — o cliente entra no funil, recebe um orçamento, o serviço é
 * agendado e, ao ser executado, vira registro no histórico de atendimento.
 *
 * ## A máquina de estados
 *
 * A §12 pedia definir os status e as transições. As regras adotadas:
 *
 * ```
 *   agendado ⇄ confirmado
 *      │           │
 *      ├───────────┴──executar──▶ executado  (final)
 *      │
 *      └───────────┬──cancelar──▶ cancelado ──reagendar──▶ agendado
 * ```
 *
 * - **`confirmado` é ida e volta.** O cliente confirma a visita e depois avisa
 *   que não poderá; voltar para `agendado` é mais honesto que cancelar e
 *   recriar, e preserva o histórico do compromisso.
 *
 * - **`executado` é final.** O serviço foi feito. Desfazer isso significaria
 *   apagar um fato — e, mais adiante, a receita que ele gerou.
 *
 * - **`cancelado` volta para `agendado`.** Remarcar é o caso mais comum de
 *   toda agenda de prestador de serviço. Obrigar a recriar do zero perderia o
 *   vínculo com o orçamento e com o histórico.
 */

export const agendamentoFormSchema = z.object({
  clienteId: z.uuid('Selecione o cliente'),

  /** Opcional: nem todo compromisso é de um serviço do catálogo. */
  servicoId: opcional(z.uuid()),

  /**
   * Data e hora, no formato que o `<input type="datetime-local">` produz:
   * `2026-08-20T14:30`. Diferente do atendimento, que é data pura — aqui a
   * hora importa, porque é um compromisso a cumprir.
   */
  dataHora: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, 'Informe data e hora'),

  observacoes: textoOpcional(2000),
});

export type AgendamentoFormInput = z.infer<typeof agendamentoFormSchema>;
export type AgendamentoFormEntrada = z.input<typeof agendamentoFormSchema>;

export const agendamentosQuerySchema = paginacaoQuerySchema.extend({
  status: statusAgendamentoSchema.optional(),
  clienteId: z.uuid().optional(),
  /** Início do período, `AAAA-MM-DD`. */
  de: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /** Fim do período, inclusive. */
  ate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type AgendamentosQuery = z.infer<typeof agendamentosQuerySchema>;

export const ACOES_AGENDAMENTO = ['confirmar', 'executar', 'cancelar', 'reagendar'] as const;
export const acaoAgendamentoSchema = z.enum(ACOES_AGENDAMENTO);
export type AcaoAgendamento = z.infer<typeof acaoAgendamentoSchema>;

export const mudarStatusAgendamentoSchema = z.object({
  acao: acaoAgendamentoSchema,
});

export type MudarStatusAgendamentoInput = z.infer<typeof mudarStatusAgendamentoSchema>;

/**
 * A máquina de estados, em um lugar só.
 *
 * Lida pelos dois lados: a API valida a transição com ela, a tela decide quais
 * botões mostrar. Uma tabela só significa que a interface nunca oferece uma
 * ação que o servidor recusaria.
 */
export const TRANSICOES_AGENDAMENTO: Record<
  StatusAgendamento,
  Partial<Record<AcaoAgendamento, StatusAgendamento>>
> = {
  agendado: { confirmar: 'confirmado', executar: 'executado', cancelar: 'cancelado' },
  // Voltar a `agendado` é ida e volta: o cliente confirmou e depois desmarcou.
  confirmado: { executar: 'executado', cancelar: 'cancelado', reagendar: 'agendado' },
  // O serviço foi feito. Desfazer apagaria um fato.
  executado: {},
  cancelado: { reagendar: 'agendado' },
};

export function acoesAgendamentoDisponiveis(status: StatusAgendamento): AcaoAgendamento[] {
  return Object.keys(TRANSICOES_AGENDAMENTO[status]) as AcaoAgendamento[];
}

export const ROTULO_STATUS_AGENDAMENTO: Record<StatusAgendamento, string> = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  executado: 'Executado',
  cancelado: 'Cancelado',
};

export const ROTULO_ACAO_AGENDAMENTO: Record<AcaoAgendamento, string> = {
  confirmar: 'Confirmar',
  executar: 'Marcar como executado',
  cancelar: 'Cancelar',
  reagendar: 'Reagendar',
};

export interface Agendamento {
  id: string;
  clienteId: string;
  clienteNome: string;
  clienteTelefone: string | null;
  servicoId: string | null;
  servicoNome: string | null;
  /** ISO completo, com hora. */
  dataHora: string;
  observacoes: string | null;
  status: StatusAgendamento;
  criadoEm: string;
}

/** Um compromisso futuro que ainda não foi cancelado nem executado. */
export function estaPendente(agendamento: Agendamento): boolean {
  return agendamento.status === 'agendado' || agendamento.status === 'confirmado';
}

/** Compromisso pendente cuja data já passou — precisa de desfecho. */
export function estaAtrasado(agendamento: Agendamento): boolean {
  return estaPendente(agendamento) && new Date(agendamento.dataHora) < new Date();
}

/** Formata data e hora para exibição em pt-BR. */
export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
