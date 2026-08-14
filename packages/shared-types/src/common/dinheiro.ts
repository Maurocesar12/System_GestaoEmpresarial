import { z } from 'zod';

/**
 * Valor monetário.
 *
 * O banco guarda em NUMERIC/DECIMAL (arquitetura §7 — nunca FLOAT). Para não
 * jogar fora essa precisão no transporte, dinheiro trafega em JSON como
 * **string decimal** ("1234.56"), nunca como `number`: `JSON.parse` devolve
 * float de 64 bits e o erro de arredondamento se acumula no fluxo de caixa.
 *
 * Formatação para exibição é responsabilidade do frontend (Intl.NumberFormat).
 * Aritmética deve acontecer no banco ou com biblioteca decimal.
 */
export const dinheiroSchema = z
  .string()
  .regex(/^-?\d+(\.\d{1,2})?$/, 'Valor monetário inválido — use o formato "1234.56"');

export type Dinheiro = z.infer<typeof dinheiroSchema>;

/**
 * Construído uma vez, no módulo.
 *
 * Montar um `Intl.NumberFormat` custa resolução de locale — ordens de grandeza
 * mais caro que formatar um número com ele pronto. Como `formatarBRL` é chamada
 * dentro de `.map()` de tabelas e cartões, criar um formatador por valor
 * significaria dezenas de construções por tela.
 */
const FORMATADOR_BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/** Formata um valor monetário para exibição em pt-BR (R$ 1.234,56). */
export function formatarBRL(valor: Dinheiro): string {
  return FORMATADOR_BRL.format(Number(valor));
}

/**
 * Converte um valor monetário digitado por gente para o formato decimal.
 *
 * Aceita as duas formas em que o valor pode chegar:
 *
 * - `"1.234,56"` — como a pessoa digita, à brasileira
 * - `"1234.56"` — como o schema já devolveu numa validação anterior
 *
 * ## Por que reconhecer as duas
 *
 * Estes schemas são validados **duas vezes**: no formulário e na Server Action.
 * A versão anterior desta função só entendia o formato brasileiro, e removia
 * todos os pontos por considerá-los separadores de milhar. Na segunda passada,
 * o `"250.00"` que ela mesma havia produzido virava `"25000"` — **R$ 250,00
 * transformado em R$ 25.000,00**, sem erro nenhum, direto para o banco.
 *
 * A regra de desambiguação: se há vírgula, é formato brasileiro. Sem vírgula,
 * um ponto seguido de exatamente uma ou duas casas é separador decimal
 * (`"1234.56"`); qualquer outro arranjo de pontos é separador de milhar
 * (`"1.234"` são mil duzentos e trinta e quatro).
 */
export function normalizarDinheiro(valor: string): string {
  const texto = valor.trim();

  if (texto.includes(',')) {
    // Formato brasileiro: pontos são milhar, a vírgula é o decimal.
    return texto.replace(/\./g, '').replace(',', '.');
  }

  // Sem vírgula: um único ponto com 1 ou 2 casas depois já é o decimal.
  if (/^-?\d+\.\d{1,2}$/.test(texto)) {
    return texto;
  }

  // Qualquer outro ponto é separador de milhar.
  return texto.replace(/\./g, '');
}

/**
 * Valor monetário digitado em formulário, normalizado e validado.
 *
 * É idempotente: validar o resultado de uma validação devolve o mesmo valor.
 * Há teste garantindo isso — `schemas-idempotentes.spec.ts`.
 */
export const dinheiroDigitadoSchema = z
  .string()
  .trim()
  .transform(normalizarDinheiro)
  .pipe(dinheiroSchema);
