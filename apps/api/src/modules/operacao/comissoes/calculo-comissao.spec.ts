import { percentualComissaoSchema } from '@gestao/shared-types';
import { Prisma } from '../../../generated/prisma/client';
import { calcularComissao } from './calculo-comissao';

const d = (valor: string) => new Prisma.Decimal(valor);

describe('calcularComissao', () => {
  it('aplica o percentual e arredonda para centavos', () => {
    expect(calcularComissao(d('333.33'), d('10'))?.toFixed(2)).toBe('33.33');
    expect(calcularComissao(d('1500.00'), d('7.5'))?.toFixed(2)).toBe('112.50');
  });

  it('não gera comissão sem percentual', () => {
    expect(calcularComissao(d('1000'), null)).toBeNull();
    expect(calcularComissao(d('1000'), d('0'))).toBeNull();
  });

  it('não gera comissão sem base', () => {
    expect(calcularComissao(null, d('10'))).toBeNull();
    expect(calcularComissao(d('0'), d('10'))).toBeNull();
  });
});

describe('percentualComissaoSchema', () => {
  it('aceita vírgula e devolve com ponto', () => {
    expect(percentualComissaoSchema.parse('7,5')).toBe('7.5');
  });

  it('é idempotente', () => {
    const primeira = percentualComissaoSchema.parse('12,25');
    expect(percentualComissaoSchema.parse(primeira)).toBe(primeira);
  });

  it('recusa acima de 100 e mais de duas casas', () => {
    expect(percentualComissaoSchema.safeParse('100,5').success).toBe(false);
    expect(percentualComissaoSchema.safeParse('5,123').success).toBe(false);
  });
});
