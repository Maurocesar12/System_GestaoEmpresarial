import { z } from 'zod';
import { dinheiroDigitadoSchema } from '../common/dinheiro';
import { opcional, textoOpcional } from '../common/opcional';
import { paginacaoQuerySchema } from '../common/paginacao';
import { statusOrcamentoSchema, type StatusOrcamento } from '../enums';

/**
 * Contrato de orçamentos (arquitetura §7).
 *
 * ## A máquina de estados
 *
 * A §12 pedia definir "quais status existem e quais transições são permitidas".
 * As regras adotadas:
 *
 * ```
 *   aberto ──aprovar──▶ aprovado   (final)
 *      │
 *      └──recusar───▶ recusado ──reabrir──▶ aberto
 * ```
 *
 * - **`aprovado` é final.** Aprovar um orçamento é o momento em que ele vira
 *   compromisso: dispara o serviço e, mais adiante, a receita no financeiro.
 *   Permitir voltar atrás significaria que um valor já contabilizado pode
 *   mudar depois — o tipo de coisa que faz o fluxo de caixa deixar de fechar.
 *   Se o combinado mudar, o caminho é emitir um orçamento novo, e o histórico
 *   preserva os dois.
 *
 * - **`recusado` volta para `aberto`.** Recusa raramente é o fim: o cliente
 *   acha caro, negocia, e o mesmo orçamento é revisto. Obrigar a recomeçar do
 *   zero seria digitar tudo de novo sem ganho nenhum.
 *
 * Transições inválidas são recusadas pela API com a mensagem dizendo o que é
 * possível a partir do estado atual — e não silenciosamente ignoradas.
 */

export const orcamentoFormSchema = z.object({
  clienteId: z.uuid('Selecione o cliente'),

  /** Opcional: nem todo orçamento se encaixa num serviço do catálogo. */
  servicoId: opcional(z.uuid()),

  descricao: textoOpcional(2000),

  valor: dinheiroDigitadoSchema,

  /** Data limite da proposta, no formato AAAA-MM-DD. */
  validoAte: opcional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')),
});

export type OrcamentoFormInput = z.infer<typeof orcamentoFormSchema>;
export type OrcamentoFormEntrada = z.input<typeof orcamentoFormSchema>;

export const orcamentosQuerySchema = paginacaoQuerySchema.extend({
  status: statusOrcamentoSchema.optional(),
  clienteId: z.uuid().optional(),
});

export type OrcamentosQuery = z.infer<typeof orcamentosQuerySchema>;

/** As ações possíveis sobre um orçamento. */
export const ACOES_ORCAMENTO = ['aprovar', 'recusar', 'reabrir'] as const;
export const acaoOrcamentoSchema = z.enum(ACOES_ORCAMENTO);
export type AcaoOrcamento = z.infer<typeof acaoOrcamentoSchema>;

export const mudarStatusSchema = z.object({
  acao: acaoOrcamentoSchema,
});

export type MudarStatusInput = z.infer<typeof mudarStatusSchema>;

/**
 * A máquina de estados, em um lugar só.
 *
 * Backend e frontend leem daqui: a API para recusar transição inválida, a tela
 * para mostrar apenas os botões que fazem sentido. Duplicar essa tabela seria
 * garantir que um dia os dois discordariam.
 */
export const TRANSICOES: Record<
  StatusOrcamento,
  Partial<Record<AcaoOrcamento, StatusOrcamento>>
> = {
  aberto: { aprovar: 'aprovado', recusar: 'recusado' },
  // Aprovado é final: o valor já virou compromisso.
  aprovado: {},
  recusado: { reabrir: 'aberto' },
};

/** As ações disponíveis a partir de um status. */
export function acoesDisponiveis(status: StatusOrcamento): AcaoOrcamento[] {
  return Object.keys(TRANSICOES[status]) as AcaoOrcamento[];
}

/** Rótulos para exibição. */
export const ROTULO_STATUS: Record<StatusOrcamento, string> = {
  aberto: 'Aberto',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
};

export const ROTULO_ACAO: Record<AcaoOrcamento, string> = {
  aprovar: 'Aprovar',
  recusar: 'Recusar',
  reabrir: 'Reabrir',
};

export interface Orcamento {
  id: string;
  clienteId: string;
  clienteNome: string;
  servicoId: string | null;
  servicoNome: string | null;
  descricao: string | null;
  /** String decimal — nunca `number`, para não perder centavos. */
  valor: string;
  status: StatusOrcamento;
  validoAte: string | null;
  respondidoEm: string | null;
  criadoEm: string;
}

/** Totais por status, para o resumo da tela. */
export interface ResumoOrcamentos {
  abertos: { quantidade: number; valor: string };
  aprovados: { quantidade: number; valor: string };
  recusados: { quantidade: number; valor: string };
}

/** Um orçamento aberto cuja validade já passou. */
export function estaVencido(orcamento: Orcamento): boolean {
  if (orcamento.status !== 'aberto' || !orcamento.validoAte) {
    return false;
  }

  // Comparação por data, não por instante: um orçamento válido até hoje
  // continua válido durante o dia inteiro.
  const hoje = new Date().toISOString().slice(0, 10);

  return orcamento.validoAte < hoje;
}
