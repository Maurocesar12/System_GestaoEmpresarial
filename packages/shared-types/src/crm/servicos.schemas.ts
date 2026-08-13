import { z } from 'zod';
import { dinheiroSchema } from '../common/dinheiro';
import { paginacaoQuerySchema } from '../common/pagination';

/**
 * Contrato do catálogo de serviços (arquitetura §7).
 *
 * O serviço é o que liga o CRM ao financeiro. `custoBase` é o que a empresa
 * gasta para executá-lo — material, deslocamento, tempo — e é a partir dele que
 * a margem por tipo de serviço se torna calculável, ligando cada receita e cada
 * custo ao atendimento que os gerou.
 *
 * Sem esse número, o sistema saberia quanto entrou, mas não quanto sobrou.
 */

/**
 * Valor monetário digitado por gente.
 *
 * O formulário recebe "1.234,56" ou "1234,56"; o banco e a API trabalham com
 * "1234.56". A conversão acontece aqui, uma vez só, em vez de espalhada pelas
 * telas.
 */
const dinheiroDigitadoSchema = z
  .string()
  .trim()
  .transform((valor) => valor.replace(/\./g, '').replace(',', '.'))
  .pipe(dinheiroSchema);

/** Campo de dinheiro opcional: vazio vira `null`, não zero. */
const dinheiroOpcionalSchema = z
  .union([dinheiroDigitadoSchema, z.literal('')])
  .optional()
  .transform((valor) => (valor === '' || valor === undefined ? null : valor));

export const servicoFormSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do serviço').max(120),
  categoria: z
    .union([z.string().trim().max(60), z.literal('')])
    .optional()
    .transform((valor) => (valor === '' || valor === undefined ? null : valor)),

  /**
   * Obrigatório, e pode ser zero.
   *
   * Zero é uma resposta legítima — há serviços sem custo direto. O que não pode
   * é ficar em branco: um catálogo com custo desconhecido inviabiliza o
   * relatório de margem, que é o diferencial do produto.
   */
  custoBase: dinheiroDigitadoSchema,

  /** Preço sugerido. Cada orçamento pode cobrar diferente. */
  precoPadrao: dinheiroOpcionalSchema,

  ativo: z.boolean().default(true),
});

export type ServicoFormInput = z.infer<typeof servicoFormSchema>;
export type ServicoFormEntrada = z.input<typeof servicoFormSchema>;

export const servicosQuerySchema = paginacaoQuerySchema.extend({
  busca: z.string().trim().max(120).optional(),
  /** `true` esconde os serviços desativados. */
  somenteAtivos: z.coerce.boolean().optional(),
});

export type ServicosQuery = z.infer<typeof servicosQuerySchema>;

export interface Servico {
  id: string;
  nome: string;
  categoria: string | null;
  /** String decimal — ver `dinheiro.ts` para o porquê de não ser `number`. */
  custoBase: string;
  precoPadrao: string | null;
  ativo: boolean;
  criadoEm: string;
}

/**
 * Margem de um serviço, em percentual sobre o preço.
 *
 * Calculada com `Number` apenas para **exibir**. Os valores que entram em
 * relatório financeiro são somados pelo banco, em `NUMERIC`, onde não há erro
 * de arredondamento. Aqui a diferença de centavos não muda a decisão de
 * ninguém — em um total acumulado, mudaria.
 */
export function margemPercentual(custoBase: string, preco: string | null): number | null {
  if (!preco) return null;

  const valorPreco = Number(preco);
  const valorCusto = Number(custoBase);

  // Preço zero tornaria a conta uma divisão por zero.
  if (valorPreco <= 0) return null;

  return ((valorPreco - valorCusto) / valorPreco) * 100;
}
