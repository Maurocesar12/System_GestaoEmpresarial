import { z } from 'zod';
import { dinheiroDigitadoSchema } from '../common/dinheiro';
import { opcional, textoOpcional } from '../common/opcional';
import { paginacaoQuerySchema } from '../common/paginacao';
import { UNIDADES_MATERIAL } from './estoque-exibicao';

/**
 * Contrato do estoque de materiais.
 *
 * ## Como o material chega à margem
 *
 * ```
 *   compra     → entrada de estoque (atualiza quantidade e custo médio)
 *   execução   → consumo pelo custo médio, apontando para o serviço
 *   margem     = receita − custos lançados − materiais consumidos − comissões
 * ```
 *
 * A compra entra no caixa pelo financeiro, mas **não** aponta para serviço
 * nenhum: o custo do material só chega à margem quando é consumido. Se a compra
 * também apontasse para o serviço, o mesmo parafuso seria custo duas vezes.
 */

export const unidadeMaterialSchema = z.enum(UNIDADES_MATERIAL);
export type UnidadeMaterial = z.infer<typeof unidadeMaterialSchema>;

export const TIPOS_MOVIMENTACAO_ESTOQUE = ['entrada', 'consumo', 'ajuste'] as const;
export type TipoMovimentacaoEstoque = (typeof TIPOS_MOVIMENTACAO_ESTOQUE)[number];

export const ROTULO_TIPO_MOVIMENTACAO: Record<TipoMovimentacaoEstoque, string> = {
  entrada: 'Entrada',
  consumo: 'Consumo',
  ajuste: 'Ajuste de contagem',
};

/**
 * Quantidade digitada, com até três casas.
 *
 * Com vírgula é formato brasileiro ("1.250,5"); sem vírgula o ponto é decimal
 * ("2.5"). Idempotente como o dinheiro: validar o próprio resultado não muda o
 * valor — a validação roda no formulário e de novo na Server Action.
 */
export function normalizarQuantidade(valor: string): string {
  const texto = valor.trim();
  return texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto;
}

const quantidadeBaseSchema = z
  .string()
  .trim()
  .transform(normalizarQuantidade)
  .pipe(z.string().regex(/^\d{1,11}(\.\d{1,3})?$/, 'Use uma quantidade com até 3 casas decimais'));

export const quantidadeSchema = quantidadeBaseSchema.refine((valor) => Number(valor) > 0, {
  message: 'A quantidade precisa ser maior que zero',
});

/** Zero é resposta válida: a contagem pode encontrar a prateleira vazia. */
export const quantidadeNaoNegativaSchema = quantidadeBaseSchema;

export const materialFormSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do material').max(120),
  unidade: unidadeMaterialSchema,
  /** Abaixo disto o material aparece como "repor". Vazio desliga o alerta. */
  estoqueMinimo: opcional(quantidadeNaoNegativaSchema),
  ativo: z.boolean().default(true),
});
export type MaterialFormInput = z.infer<typeof materialFormSchema>;

export const entradaEstoqueSchema = z.object({
  quantidade: quantidadeSchema,
  /** Quanto custou cada unidade nesta compra. */
  custoUnitario: dinheiroDigitadoSchema,
  /** `AAAA-MM-DD`. Vazio usa hoje. */
  data: opcional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')),
  observacao: textoOpcional(240),
});
export type EntradaEstoqueInput = z.infer<typeof entradaEstoqueSchema>;

/**
 * Ajuste pela contagem física.
 *
 * Recebe o que **existe** na prateleira, e não a diferença: é o número que a
 * pessoa tem em mãos depois de contar. O motivo é obrigatório porque ajuste sem
 * explicação é exatamente o lançamento que ninguém consegue auditar depois.
 */
export const ajusteEstoqueSchema = z.object({
  quantidadeContada: quantidadeNaoNegativaSchema,
  observacao: z.string().trim().min(3, 'Explique o motivo do ajuste').max(240),
});
export type AjusteEstoqueInput = z.infer<typeof ajusteEstoqueSchema>;

export const materiaisQuerySchema = paginacaoQuerySchema.extend({
  busca: z.string().trim().max(120).optional(),
  somenteAtivos: z.coerce.boolean().optional(),
  abaixoDoMinimo: z.coerce.boolean().optional(),
});
export type MateriaisQuery = z.infer<typeof materiaisQuerySchema>;

export const itemMaterialSchema = z.object({
  materialId: z.uuid('Selecione o material'),
  quantidade: quantidadeSchema,
});
export type ItemMaterialInput = z.infer<typeof itemMaterialSchema>;

const semMaterialRepetido = (itens: ItemMaterialInput[]) =>
  new Set(itens.map((item) => item.materialId)).size === itens.length;

export const listaMateriaisSchema = z
  .array(itemMaterialSchema)
  .max(50, 'No máximo 50 materiais por serviço')
  .refine(semMaterialRepetido, { message: 'Cada material aparece uma vez só na lista' });

/** Lista padrão de materiais de um serviço. */
export const fichaTecnicaSchema = z.object({ itens: listaMateriaisSchema });
export type FichaTecnicaInput = z.infer<typeof fichaTecnicaSchema>;

/**
 * Prévia do custo de uma lista de materiais enquanto a pessoa edita.
 *
 * Mesma forma da ficha técnica. A API multiplica pelo custo médio lido do
 * banco agora — a tela usava o custo da lista que tinha carregado, que podia
 * ter mudado com uma entrada de estoque registrada nesse meio-tempo.
 */
export const simulacaoCustoMateriaisSchema = fichaTecnicaSchema;
export type SimulacaoCustoMateriaisInput = FichaTecnicaInput;

export interface SimulacaoCustoMateriais {
  /** Custo de cada linha, na ordem enviada. */
  linhas: Array<{ materialId: string; custo: string }>;
  custoTotal: string;
}

export interface Material {
  id: string;
  nome: string;
  unidade: UnidadeMaterial;
  /** String decimal com até 3 casas. Pode ser negativa: o consumo não trava a execução. */
  quantidade: string;
  /** Custo médio ponderado, com 4 casas para não perder precisão entre compras. */
  custoMedio: string;
  /** `quantidade × custoMedio`, em dinheiro. */
  valorEmEstoque: string;
  estoqueMinimo: string | null;
  abaixoDoMinimo: boolean;
  /** Consumo registrado além do que havia: o saldo ficou abaixo de zero. */
  negativo: boolean;
  ativo: boolean;
  criadoEm: string;
}

/**
 * Totais do estoque inteiro, somados pela API.
 *
 * A tela somava os materiais da página que tinha carregado — com busca, filtro
 * ou mais de cem materiais, o "valor em estoque" ficava errado sem aviso.
 */
export interface ResumoEstoque {
  /** Soma de `valorEmEstoque` dos materiais ativos. Saldo negativo conta zero. */
  valorEmEstoque: string;
  materiaisAtivos: number;
  abaixoDoMinimo: number;
  negativos: number;
}

export interface MovimentacaoEstoque {
  id: string;
  tipo: TipoMovimentacaoEstoque;
  /** Em ajuste o sinal indica se a contagem aumentou ou diminuiu o saldo. */
  quantidade: string;
  custoUnitario: string;
  valorTotal: string;
  data: string;
  observacao: string | null;
  agendamentoId: string | null;
  servicoNome: string | null;
  criadoEm: string;
}

export interface MaterialDetalhe extends Material {
  movimentacoes: MovimentacaoEstoque[];
}

export interface ItemFichaTecnica {
  materialId: string;
  materialNome: string;
  unidade: UnidadeMaterial;
  quantidade: string;
  custoMedio: string;
  custoEstimado: string;
}

export interface FichaTecnica {
  itens: ItemFichaTecnica[];
  /** Soma dos custos estimados pelo custo médio de hoje. */
  custoEstimado: string;
}
