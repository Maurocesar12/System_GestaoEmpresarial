import { Prisma } from '../../generated/prisma/client';
import {
  ColunasNaoEncontradas,
  extrairMovimentacoes,
  normalizarData,
  sugerirVinculos,
  valorDoExtrato,
  type ContaEmAberto,
} from './conciliacao';

const conta = (parcial: Partial<ContaEmAberto>): ContaEmAberto => ({
  id: 'conta-1',
  tipo: 'saida',
  descricao: 'Aluguel do escritório',
  valor: new Prisma.Decimal('1500.00'),
  referencia: '2026-09-10',
  ...parcial,
});

describe('valorDoExtrato', () => {
  it.each([
    ['1.234,56', '1234.56'],
    ['1,234.56', '1234.56'],
    ['-150,00', '-150'],
    ['(150,00)', '-150'],
    ['R$ 99,90', '99.9'],
  ])('lê %s como %s', (texto, esperado) => {
    expect(valorDoExtrato(texto)?.toString()).toBe(esperado);
  });

  it('recusa o que não é valor', () => {
    expect(valorDoExtrato('')).toBeNull();
    expect(valorDoExtrato('abc')).toBeNull();
  });
});

describe('normalizarData', () => {
  it('entende o formato brasileiro sem trocar dia e mês', () => {
    expect(normalizarData('10/09/2026')).toBe('2026-09-10');
    expect(normalizarData('1/9/2026')).toBe('2026-09-01');
  });

  it('aceita ISO e hora no fim', () => {
    expect(normalizarData('2026-09-10')).toBe('2026-09-10');
    expect(normalizarData('2026-09-10 08:30:00')).toBe('2026-09-10');
  });

  it('não inventa data', () => {
    expect(normalizarData('ontem')).toBeNull();
  });
});

describe('extrairMovimentacoes', () => {
  it('acha as colunas pelo nome e descarta linhas incompletas', () => {
    const { movimentacoes, ignoradas } = extrairMovimentacoes(
      ['Data', 'Histórico', 'Valor R$'],
      [
        ['10/09/2026', 'PIX ALUGUEL ESCRITORIO', '-1.500,00'],
        ['11/09/2026', '', '50,00'],
        ['12/09/2026', 'TED CLIENTE', '320,00'],
      ],
    );

    expect(ignoradas).toBe(1);
    expect(movimentacoes.map((m) => [m.tipo, m.valor.toFixed(2)])).toEqual([
      ['saida', '1500.00'],
      ['entrada', '320.00'],
    ]);
  });

  it('avisa quando o extrato não tem as colunas', () => {
    expect(() => extrairMovimentacoes(['A', 'B'], [['1', '2']])).toThrow(ColunasNaoEncontradas);
  });
});

describe('sugerirVinculos', () => {
  const { movimentacoes } = extrairMovimentacoes(
    ['data', 'descricao', 'valor'],
    [['10/09/2026', 'PIX ALUGUEL ESCRITORIO', '-1.500,00']],
  );

  it('sugere a conta que bate em valor, data e descrição, com diferença zero', () => {
    const [resultado] = sugerirVinculos(movimentacoes, [conta({})]);

    expect(resultado?.contaSugeridaId).toBe('conta-1');
    expect(resultado?.opcoes[0]?.diferenca).toBe('0.00');
  });

  it('não oferece conta de sentido oposto', () => {
    const [resultado] = sugerirVinculos(movimentacoes, [conta({ tipo: 'entrada' })]);

    expect(resultado?.opcoes).toEqual([]);
    expect(resultado?.contaSugeridaId).toBeNull();
  });

  it('não sugere quando nada parece com a movimentação, mas deixa a opção para escolher', () => {
    const [resultado] = sugerirVinculos(movimentacoes, [
      conta({
        descricao: 'Internet',
        valor: new Prisma.Decimal('99.90'),
        referencia: '2026-06-01',
      }),
    ]);

    expect(resultado?.contaSugeridaId).toBeNull();
    expect(resultado?.opcoes[0]?.diferenca).toBe('1400.10');
  });
});
