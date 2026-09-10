import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../../generated/prisma/client';
import type { Env } from '../../../config/env.schema';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { PlanosService } from './planos.service';

describe('PlanosService', () => {
  const planos = [
    {
      slug: 'essencial',
      nome: 'Básico',
      descricao: 'Plano inicial',
      nivel: 1,
      destaque: false,
      preco: new Prisma.Decimal('100.00'),
      usuariosInclusos: 2,
      precoUsuarioAdicional: new Prisma.Decimal('20.00'),
      limiteUsuarios: 5,
      limiteClientes: 500,
      limiteEnviosMensais: 300,
      iaHabilitada: false,
      limitePrevisoesIaMensais: 3,
    },
    {
      slug: 'profissional',
      nome: 'Premium',
      descricao: 'Plano com IA em volume',
      nivel: 2,
      destaque: true,
      preco: new Prisma.Decimal('200.00'),
      usuariosInclusos: 5,
      precoUsuarioAdicional: new Prisma.Decimal('15.00'),
      limiteUsuarios: 20,
      limiteClientes: 3000,
      limiteEnviosMensais: 2000,
      iaHabilitada: true,
      limitePrevisoesIaMensais: 200,
    },
  ];

  it('lista somente os dois planos ativos na hierarquia comercial', async () => {
    const findMany = jest.fn().mockResolvedValue(planos);
    const prisma = {
      semTenant: (_motivo: string, operacao: (db: { plano: { findMany: typeof findMany } }) => unknown) =>
        operacao({ plano: { findMany } }),
    } as unknown as PrismaService;
    const config: ConfigService<Env, true> = new ConfigService({ OPENAI_API_KEY: undefined });

    const service = new PlanosService(prisma, config);
    const catalogo = await service.catalogo();

    expect(findMany).toHaveBeenCalledWith({
      where: { ativo: true, slug: { in: ['essencial', 'profissional'] } },
      orderBy: [{ nivel: 'asc' }, { preco: 'asc' }],
    });
    expect(catalogo.totalAtivos).toBe(2);
    expect(catalogo.hierarquia).toEqual(['essencial', 'profissional']);
    expect(catalogo.planos.map((plano) => plano.slug)).toEqual(['essencial', 'profissional']);
    expect(catalogo.planos[1]?.destaque).toBe(true);
  });
});
