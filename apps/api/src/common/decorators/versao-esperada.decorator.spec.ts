import { lerVersaoEsperada } from './versao-esperada.decorator';

describe('lerVersaoEsperada (cabeçalho If-Match)', () => {
  it('sem o cabeçalho, não confere nada', () => {
    expect(lerVersaoEsperada(undefined)).toBeUndefined();
  });

  it.each([
    ['3', 3],
    ['"3"', 3],
    ['W/"3"', 3],
    [' 12 ', 12],
  ])('aceita %s', (bruto, esperado) => {
    expect(lerVersaoEsperada(bruto)).toBe(esperado);
  });

  it.each(['', 'abc', '*', '-1', '1.5', '"3', '1234567890', '3, 4'])(
    'recusa %p com 400',
    (bruto) => {
      expect(() => lerVersaoEsperada(bruto)).toThrow(expect.objectContaining({ status: 400 }));
    },
  );
});
