import { dinheiroDigitadoSchema, formatarBRL, normalizarDinheiro } from '@gestao/shared-types';

/**
 * Conversão de valores monetários.
 *
 * Estes testes existem por causa de um bug que passou despercebido até um
 * teste de idempotência revelá-lo: a versão anterior removia todos os pontos
 * do valor, achando que eram separadores de milhar. Como os schemas são
 * validados duas vezes, o `"250.00"` produzido pela primeira validação virava
 * `"25000"` na segunda — R$ 250,00 gravados como R$ 25.000,00, sem erro nenhum.
 *
 * Erro em dinheiro não avisa: ele aparece no fluxo de caixa no fim do mês.
 */
describe('normalizarDinheiro', () => {
  describe('formato brasileiro (como a pessoa digita)', () => {
    it.each([
      ['1.234,56', '1234.56'],
      ['1234,56', '1234.56'],
      ['250,00', '250.00'],
      ['0,50', '0.50'],
      ['1.000.000,00', '1000000.00'],
    ])('converte %s em %s', (entrada, esperado) => {
      expect(normalizarDinheiro(entrada)).toBe(esperado);
    });
  });

  describe('formato decimal (como o schema já devolveu)', () => {
    it.each([
      ['250.00', '250.00'],
      ['1234.56', '1234.56'],
      ['0.50', '0.50'],
      ['1000000.00', '1000000.00'],
    ])('mantém %s inalterado', (entrada, esperado) => {
      // O caso do bug: sem esta regra, "250.00" virava "25000".
      expect(normalizarDinheiro(entrada)).toBe(esperado);
    });
  });

  describe('separador de milhar sem decimais', () => {
    it.each([
      ['1.234', '1234'],
      ['1.000.000', '1000000'],
    ])('trata o ponto de %s como milhar, resultando em %s', (entrada, esperado) => {
      // Três ou mais dígitos após o ponto não são centavos.
      expect(normalizarDinheiro(entrada)).toBe(esperado);
    });
  });

  it('é idempotente: converter o resultado devolve o mesmo valor', () => {
    const valores = ['1.234,56', '250,00', '0,50', '1.000.000,00'];

    for (const valor of valores) {
      const uma = normalizarDinheiro(valor);
      const duas = normalizarDinheiro(uma);

      expect(duas).toBe(uma);
    }
  });
});

describe('dinheiroDigitadoSchema', () => {
  it('aceita valor digitado e devolve decimal', () => {
    expect(dinheiroDigitadoSchema.parse('1.500,00')).toBe('1500.00');
  });

  it('aceita o próprio resultado de volta, sem alterá-lo', () => {
    const primeira = dinheiroDigitadoSchema.parse('1.500,00');
    const segunda = dinheiroDigitadoSchema.parse(primeira);

    expect(segunda).toBe(primeira);
    expect(segunda).toBe('1500.00');
  });

  it('recusa texto que não é valor monetário', () => {
    expect(dinheiroDigitadoSchema.safeParse('abc').success).toBe(false);
    expect(dinheiroDigitadoSchema.safeParse('').success).toBe(false);
  });

  it('recusa mais de duas casas decimais', () => {
    // Centavos têm duas casas. Três indicaria erro de digitação ou de conversão.
    expect(dinheiroDigitadoSchema.safeParse('10,123').success).toBe(false);
  });
});

describe('formatarBRL', () => {
  it.each([
    ['1500.00', '1.500,00'],
    ['0.50', '0,50'],
    ['1000000.00', '1.000.000,00'],
  ])('formata %s como R$ %s', (entrada, esperado) => {
    const formatado = formatarBRL(entrada);

    // O Intl separa "R$" do número com espaço não-quebrável (U+00A0), não com
    // espaço comum. Escrito como escape na regex, e não como literal: o
    // caractere é invisível no editor, e um dia alguém o apagaria sem perceber
    // — deixando um teste que falha sem motivo aparente.
    expect(formatado).toContain('R$');
    expect(formatado.replace(/^R\$\s*/, '')).toBe(esperado);
  });
});
