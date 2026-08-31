import { somarDinheiro } from '@gestao/shared-types';

/**
 * A soma de dinheiro é feita em centavos inteiros de propósito. Estes testes
 * existem para que ninguém "simplifique" isso de volta para ponto flutuante.
 */
describe('somarDinheiro', () => {
  it('soma valores simples', () => {
    expect(somarDinheiro(['10.00', '5.50'])).toBe('15.50');
  });

  it('não acumula resíduo de ponto flutuante', () => {
    // Em ponto flutuante, 0.1 + 0.2 dá 0.30000000000000004.
    expect(somarDinheiro(['0.10', '0.20'])).toBe('0.30');
  });

  it('mantém a exatidão em somas longas', () => {
    // Somar 0.07 dez vezes com `Number` daria 0.6999999999999998.
    expect(somarDinheiro(Array.from({ length: 10 }, () => '0.07'))).toBe('0.70');
  });

  it('devolve zero para lista vazia', () => {
    expect(somarDinheiro([])).toBe('0.00');
  });

  it('lida com valores negativos', () => {
    expect(somarDinheiro(['100.00', '-30.50'])).toBe('69.50');
  });

  it('resulta em negativo quando as saídas superam as entradas', () => {
    expect(somarDinheiro(['10.00', '-25.75'])).toBe('-15.75');
  });

  it('aceita valores sem casas decimais', () => {
    expect(somarDinheiro(['10', '5.5'])).toBe('15.50');
  });

  it('suporta valores grandes sem perder centavos', () => {
    expect(somarDinheiro(['999999999.99', '0.01'])).toBe('1000000000.00');
  });
});
