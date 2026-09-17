import { Prisma } from '../../../generated/prisma/client';
import { custoMedioAposEntrada, paraQuantidade, valorMovimentacao } from './calculo-estoque';

const d = (valor: string) => new Prisma.Decimal(valor);

describe('custoMedioAposEntrada', () => {
  it('pondera o custo pelo que já havia e pelo que entrou', () => {
    expect(custoMedioAposEntrada(d('10'), d('5'), d('10'), d('7')).toFixed(4)).toBe('6.0000');
  });

  it('mantém quatro casas para compras de centavos por unidade', () => {
    expect(custoMedioAposEntrada(d('3'), d('0.10'), d('1'), d('0.25')).toFixed(4)).toBe('0.1375');
  });

  it('usa o custo da compra quando o saldo está zerado', () => {
    expect(custoMedioAposEntrada(d('0'), d('9'), d('4'), d('2.5')).toFixed(4)).toBe('2.5000');
  });

  it('ignora o custo antigo quando o saldo está negativo', () => {
    expect(custoMedioAposEntrada(d('-2'), d('9'), d('5'), d('3')).toFixed(4)).toBe('3.0000');
  });
});

describe('valorMovimentacao', () => {
  it('arredonda para centavos', () => {
    expect(valorMovimentacao(d('2.5'), d('1.3333')).toFixed(2)).toBe('3.33');
  });
});

describe('paraQuantidade', () => {
  it.each([
    ['12.500', '12.5'],
    ['100.000', '100'],
    ['0.000', '0'],
    ['-1.250', '-1.25'],
    ['0.005', '0.005'],
  ])('%s vira %s', (entrada, esperado) => {
    expect(paraQuantidade(d(entrada))).toBe(esperado);
  });
});
