import { Prisma } from '../../../generated/prisma/client';
import { calcularMensalidade } from './calcular-mensalidade';

describe('calcularMensalidade', () => {
  it('não cobra adicional enquanto os usuários ativos estão na franquia', () => {
    const resultado = calcularMensalidade({
      precoBase: new Prisma.Decimal('100.00'),
      usuariosAtivos: 2,
      usuariosInclusos: 2,
      precoUsuarioAdicional: new Prisma.Decimal('20.00'),
    });

    expect(resultado.usuariosAdicionais).toBe(0);
    expect(resultado.adicionalUsuarios.toFixed(2)).toBe('0.00');
    expect(resultado.mensalidade.toFixed(2)).toBe('100.00');
  });

  it('cobra somente os usuários ativos acima da franquia', () => {
    const resultado = calcularMensalidade({
      precoBase: new Prisma.Decimal('200.00'),
      usuariosAtivos: 8,
      usuariosInclusos: 5,
      precoUsuarioAdicional: new Prisma.Decimal('15.00'),
    });

    expect(resultado.usuariosAdicionais).toBe(3);
    expect(resultado.adicionalUsuarios.toFixed(2)).toBe('45.00');
    expect(resultado.mensalidade.toFixed(2)).toBe('245.00');
  });

  it('mantém o plano legado ilimitado sem adicional', () => {
    const resultado = calcularMensalidade({
      precoBase: new Prisma.Decimal('397.00'),
      usuariosAtivos: 80,
      usuariosInclusos: null,
      precoUsuarioAdicional: new Prisma.Decimal('0.00'),
    });

    expect(resultado.usuariosAdicionais).toBe(0);
    expect(resultado.mensalidade.toFixed(2)).toBe('397.00');
  });
});
