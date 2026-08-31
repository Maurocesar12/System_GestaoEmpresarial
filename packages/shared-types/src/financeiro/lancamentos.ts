import { z } from 'zod';
import { dinheiroDigitadoSchema } from '../common/dinheiro';
import { opcional, textoOpcional } from '../common/opcional';
import { paginacaoQuerySchema } from '../common/paginacao';
import {
  naturezaLancamentoSchema,
  tipoCustoSchema,
  tipoLancamentoSchema,
  type NaturezaLancamento,
  type TipoCusto,
  type TipoLancamento,
} from '../enums';

/**
 * Contrato do financeiro (arquitetura §7).
 *
 * ## Por que isto existe no mesmo sistema que o CRM
 *
 * É o diferencial do produto (§1): a maioria dos CRMs não tem financeiro, e a
 * maioria dos financeiros não tem CRM. Aqui os dois vivem no mesmo banco, e é
 * isso que torna possível calcular **margem por tipo de serviço** — ligando
 * cada receita e cada custo ao atendimento que os gerou.
 *
 * ## Separação pessoal/empresa
 *
 * O público é PME de serviço, onde a conta da empresa e a do dono costumam ser
 * a mesma. `natureza` marca cada lançamento, e o fluxo de caixa da empresa
 * ignora os pessoais — sem isso, o almoço de domingo entraria no custo
 * operacional e distorceria a margem.
 */

// --- Categorias ------------------------------------------------------------

export const categoriaFormSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome da categoria').max(60),

  /**
   * Fixo custa igual todo mês (aluguel, internet); variável acompanha o
   * movimento (combustível, material). A distinção é o que permite calcular o
   * custo operacional diário — a §12 pede essa fórmula, e ela depende de saber
   * quanto do custo é fixo.
   */
  tipoCusto: tipoCustoSchema,
});

export type CategoriaFormInput = z.infer<typeof categoriaFormSchema>;

export interface CategoriaFinanceira {
  id: string;
  nome: string;
  tipoCusto: TipoCusto;
  criadoEm: string;
}

// --- Lançamentos -----------------------------------------------------------

export const lancamentoFormSchema = z.object({
  tipo: tipoLancamentoSchema,
  natureza: naturezaLancamentoSchema.default('empresa'),

  descricao: z.string().trim().min(2, 'Descreva o lançamento').max(180),
  valor: dinheiroDigitadoSchema,

  /** Data do fato — a competência, `AAAA-MM-DD`. Quando o serviço foi prestado. */
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),

  /**
   * Quando o valor é devido. Vazio significa à vista.
   *
   * É o que transforma um lançamento em conta a receber ou a pagar: sem
   * vencimento não há como dizer que algo está atrasado.
   */
  vencimento: opcional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')),

  /**
   * Quando o dinheiro efetivamente entrou ou saiu. Vazio significa em aberto.
   *
   * Separado de `data` de propósito. Um serviço prestado em março e recebido em
   * maio pertence a março na competência e a maio no caixa — misturar os dois
   * é o que faz o saldo do mês mentir.
   */
  pagoEm: opcional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')),

  categoriaId: opcional(z.uuid()),

  /**
   * Serviço que gerou este valor.
   *
   * É o campo que torna a margem calculável. Uma receita sem serviço vinculado
   * entra no caixa mas não aparece em nenhuma margem — o relatório diz quanto
   * ficou de fora, para que a lacuna seja visível em vez de silenciosa.
   */
  servicoId: opcional(z.uuid()),

  clienteId: opcional(z.uuid()),
});

export type LancamentoFormInput = z.infer<typeof lancamentoFormSchema>;
export type LancamentoFormEntrada = z.input<typeof lancamentoFormSchema>;

/**
 * Situação de pagamento de um lançamento.
 *
 * **Derivada, nunca gravada.** Fica de fora de `enums.ts` — que espelha os enums
 * do Prisma — porque não existe coluna correspondente no banco. O motivo é
 * simples: "atrasado" depende de que dia é hoje. Uma coluna com esse valor
 * estaria errada na manhã seguinte, e alguém teria de sair atualizando linhas
 * todo dia à meia-noite.
 */
export const STATUS_LANCAMENTO = ['pago', 'a_vencer', 'atrasado'] as const;
export const statusLancamentoSchema = z.enum(STATUS_LANCAMENTO);
export type StatusLancamento = z.infer<typeof statusLancamentoSchema>;

export const ROTULO_STATUS_LANCAMENTO: Record<StatusLancamento, string> = {
  pago: 'Pago',
  a_vencer: 'A vencer',
  atrasado: 'Atrasado',
};

/**
 * Calcula a situação a partir das datas.
 *
 * Vive no contrato compartilhado para que API e tela cheguem sempre ao mesmo
 * resultado. Duplicar essa regra nos dois lados é como um lançamento aparece
 * "atrasado" na lista e "a vencer" no detalhe.
 *
 * @param hoje `AAAA-MM-DD`. Recebido em vez de lido do relógio para o cálculo
 *   ser determinístico — e testável sem congelar o tempo.
 */
export function statusDoLancamento(
  vencimento: string | null,
  pagoEm: string | null,
  hoje: string,
): StatusLancamento {
  if (pagoEm) return 'pago';

  // Sem vencimento não há prazo a estourar: fica pendente, nunca atrasado.
  // Comparação de texto basta porque `AAAA-MM-DD` ordena alfabeticamente igual
  // ao calendário — e evita converter para Date, onde o fuso do servidor
  // mudaria o dia.
  if (vencimento && vencimento < hoje) return 'atrasado';

  return 'a_vencer';
}

export const lancamentosQuerySchema = paginacaoQuerySchema.extend({
  tipo: tipoLancamentoSchema.optional(),
  natureza: naturezaLancamentoSchema.optional(),
  status: statusLancamentoSchema.optional(),
  categoriaId: z.uuid().optional(),
  servicoId: z.uuid().optional(),
  de: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  ate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type LancamentosQuery = z.infer<typeof lancamentosQuerySchema>;

export interface Lancamento {
  id: string;
  tipo: TipoLancamento;
  natureza: NaturezaLancamento;
  descricao: string;
  /** String decimal — nunca `number`, para não perder centavos. */
  valor: string;
  data: string;
  vencimento: string | null;
  pagoEm: string | null;
  /** Calculado pela API com `statusDoLancamento`. Não existe coluna no banco. */
  status: StatusLancamento;
  categoriaId: string | null;
  categoriaNome: string | null;
  servicoId: string | null;
  servicoNome: string | null;
  clienteId: string | null;
  clienteNome: string | null;
  criadoEm: string;
}

/** Dar baixa: registrar que o dinheiro entrou ou saiu. */
export const baixaFormSchema = z.object({
  /**
   * Quando o valor foi pago ou recebido. Vazio usa o dia de hoje.
   *
   * Existe porque a baixa costuma ser lançada depois do fato — a pessoa confere
   * o extrato na segunda e dá baixa em algo que caiu na sexta.
   */
  pagoEm: opcional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')),
});

export type BaixaFormInput = z.infer<typeof baixaFormSchema>;

/**
 * Panorama do que está em aberto.
 *
 * Responde as duas perguntas que abrem o dia de quem administra: quanto tenho a
 * receber, e o que já venceu.
 */
export interface ResumoContas {
  aReceber: { total: string; quantidade: number };
  aPagar: { total: string; quantidade: number };
  /** Já venceu e não foi pago — o subconjunto que exige ação hoje. */
  vencidoAReceber: { total: string; quantidade: number };
  vencidoAPagar: { total: string; quantidade: number };
}

// --- Relatórios ------------------------------------------------------------

/** Fluxo de caixa de um período. */
export interface FluxoDeCaixa {
  entradas: string;
  saidas: string;
  /** Entradas menos saídas. Pode ser negativo. */
  saldo: string;
  /** Quanto das saídas é custo fixo — insumo do custo operacional diário. */
  custoFixo: string;
  custoVariavel: string;
  periodo: { de: string; ate: string };
}

/**
 * Margem de um tipo de serviço no período.
 *
 * ## A fórmula, que a §12 pedia definir
 *
 * ```
 *   receita  = soma das entradas vinculadas ao serviço
 *   custo    = soma das saídas vinculadas ao serviço
 *   margem   = receita − custo
 *   margem % = margem ÷ receita
 * ```
 *
 * O custo considerado é o **direto**: apenas o que foi lançado apontando para
 * aquele serviço. Custo indireto — aluguel, internet, contador — não é rateado
 * entre os serviços, e é uma decisão consciente.
 *
 * Ratear exigiria escolher um critério (por receita? por horas? por número de
 * execuções?), e qualquer escolha embutiria uma opinião contestável dentro de
 * um número que o dono usa para decidir preço. Margem direta é honesta sobre o
 * que mede: quanto sobra de cada serviço antes das despesas da estrutura. O
 * custo fixo aparece separado no fluxo de caixa, onde não distorce nada.
 */
export interface MargemPorServico {
  servicoId: string | null;
  servicoNome: string;
  receita: string;
  custo: string;
  margem: string;
  /** `null` quando não houve receita — não há como dividir por zero. */
  margemPercentual: number | null;
  /** Quantos lançamentos de entrada compõem esta linha. */
  quantidade: number;
}

export interface RelatorioMargem {
  itens: MargemPorServico[];
  /** Receita que não aponta para serviço nenhum, e por isso não entra em nenhuma margem. */
  receitaSemServico: string;
  periodo: { de: string; ate: string };
}

export const periodoQuerySchema = z.object({
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inicial inválida'),
  ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data final inválida'),
  /** Por padrão o relatório ignora o que é pessoal. */
  natureza: naturezaLancamentoSchema.optional(),
});

export type PeriodoQuery = z.infer<typeof periodoQuerySchema>;

/** Primeiro e último dia do mês corrente, para o período padrão das telas. */
export function mesCorrente(): { de: string; ate: string } {
  const agora = new Date();
  const p = (n: number) => String(n).padStart(2, '0');

  const primeiro = `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-01`;

  // Dia zero do mês seguinte é o último dia deste mês — evita a tabela de
  // quantos dias tem cada mês, e acerta fevereiro bissexto de graça.
  const ultimoDia = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);
  const ultimo = `${ultimoDia.getFullYear()}-${p(ultimoDia.getMonth() + 1)}-${p(ultimoDia.getDate())}`;

  return { de: primeiro, ate: ultimo };
}

export const ROTULO_TIPO_LANCAMENTO: Record<TipoLancamento, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
};

export const ROTULO_NATUREZA: Record<NaturezaLancamento, string> = {
  empresa: 'Empresa',
  pessoal: 'Pessoal',
};

export const ROTULO_TIPO_CUSTO: Record<TipoCusto, string> = {
  fixo: 'Fixo',
  variavel: 'Variável',
};
