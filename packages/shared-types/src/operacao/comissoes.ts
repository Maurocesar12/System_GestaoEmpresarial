import { z } from 'zod';
import { opcional } from '../common/opcional';

/**
 * Contrato de comissões.
 *
 * ## As regras
 *
 * - **Venda:** quando um orçamento é aprovado, o vendedor dele ganha o
 *   percentual de venda cadastrado na equipe sobre o valor do orçamento.
 * - **Execução:** quando um agendamento é executado, o técnico ganha o
 *   percentual de execução sobre o valor do orçamento ligado ao agendamento —
 *   ou, sem orçamento, sobre o preço padrão do serviço.
 * - O percentual é **copiado** para a comissão no momento em que ela nasce.
 *   Mudar o percentual da pessoa depois não reescreve o que já foi gerado.
 * - Ver as comissões da equipe, fechar e definir percentuais é só do papel
 *   `admin` — não é permissão que se conceda a funcionário. Cada pessoa vê as
 *   próprias em "Minhas comissões".
 * - O fechamento de um período soma as pendentes de uma pessoa e cria uma
 *   conta a pagar no financeiro. A comissão entra na margem do serviço pela
 *   própria comissão, e não pela conta a pagar, que não aponta para serviço —
 *   senão seria custo duas vezes.
 */

export const TIPOS_COMISSAO = ['venda', 'execucao'] as const;
export const tipoComissaoSchema = z.enum(TIPOS_COMISSAO);
export type TipoComissao = z.infer<typeof tipoComissaoSchema>;

export const STATUS_COMISSAO = ['pendente', 'fechada'] as const;
export const statusComissaoSchema = z.enum(STATUS_COMISSAO);
export type StatusComissao = z.infer<typeof statusComissaoSchema>;

export const ROTULO_TIPO_COMISSAO: Record<TipoComissao, string> = {
  venda: 'Venda',
  execucao: 'Execução',
};

export const ROTULO_STATUS_COMISSAO: Record<StatusComissao, string> = {
  pendente: 'Pendente',
  fechada: 'Fechada',
};

/** Percentual de 0 a 100, com até duas casas: "5", "7,5", "12.25". */
export const percentualComissaoSchema = z
  .string()
  .trim()
  .transform((valor) => valor.replace(',', '.'))
  .pipe(z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, 'Use um percentual como 5 ou 7,5'))
  .refine((valor) => Number(valor) <= 100, { message: 'O percentual vai de 0 a 100' });

/** Vazio vira `null`: a pessoa não recebe aquele tipo de comissão. */
export const percentualComissaoOpcionalSchema = opcional(percentualComissaoSchema);

const diaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida');

export const comissoesQuerySchema = z.object({
  de: diaSchema,
  ate: diaSchema,
  usuarioId: z.uuid().optional(),
  status: statusComissaoSchema.optional(),
});
export type ComissoesQuery = z.infer<typeof comissoesQuerySchema>;

/** A pessoa vem do token, nunca da URL: ninguém consulta a comissão de outro por aqui. */
export const minhasComissoesQuerySchema = comissoesQuerySchema.omit({ usuarioId: true });
export type MinhasComissoesQuery = z.infer<typeof minhasComissoesQuerySchema>;

export const fechamentoComissaoSchema = z.object({
  usuarioId: z.uuid('Selecione a pessoa'),
  de: diaSchema,
  ate: diaSchema,
  /** Quando a comissão será paga. Vazio usa o dia do fechamento. */
  vencimento: opcional(diaSchema),
});
export type FechamentoComissaoInput = z.infer<typeof fechamentoComissaoSchema>;

export interface Comissao {
  id: string;
  usuarioId: string;
  usuarioNome: string;
  tipo: TipoComissao;
  status: StatusComissao;
  servicoId: string | null;
  servicoNome: string | null;
  clienteNome: string | null;
  orcamentoId: string | null;
  agendamentoId: string | null;
  /** Valor sobre o qual o percentual foi aplicado. */
  base: string;
  percentual: string;
  valor: string;
  /** `AAAA-MM-DD` — o dia da aprovação ou da execução. */
  competencia: string;
  lancamentoId: string | null;
  fechadaEm: string | null;
}

export interface ResumoComissaoPessoa {
  usuarioId: string;
  usuarioNome: string;
  pendente: string;
  quantidadePendente: number;
  fechada: string;
}

export interface RelatorioComissoes {
  itens: Comissao[];
  porPessoa: ResumoComissaoPessoa[];
  totalPendente: string;
  totalFechado: string;
  periodo: { de: string; ate: string };
}

export interface FechamentoComissao {
  lancamentoId: string;
  valor: string;
  quantidade: number;
}
