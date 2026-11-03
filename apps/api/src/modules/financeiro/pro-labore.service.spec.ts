import type { PrismaService } from '../../infra/prisma/prisma.service';
import { runComTenant, type TenantContext } from '../../infra/tenant/tenant-context';
import type { AuditoriaService } from '../plataforma/auditoria/auditoria.service';
import type { FinanceiroService } from './financeiro.service';
import { ProLaboreService } from './pro-labore.service';

const CONTEXTO: TenantContext = {
  tenantId: '0198f1a0-0000-7000-8000-000000000001',
  usuarioId: '0198f1a0-0000-7000-8000-000000000002',
  papel: 'admin',
  requestId: 'r1',
};

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);

type Filtro = { vigenciaInicio?: { lt?: Date; gt?: Date } | Date };

describe('ProLaboreService.definir — encaixe no histórico', () => {
  const ordem: string[] = [];

  /** `vizinhos` responde às buscas "anterior" (início < novo) e "seguinte" (início > novo). */
  function montar(vizinhos: { anterior?: { id: string }; seguinte?: { vigenciaInicio: Date } }) {
    const tx = {
      $executeRaw: jest.fn(() => {
        ordem.push('lock');
        return Promise.resolve(1);
      }),
      proLabore: {
        findFirst: jest.fn(({ where }: { where: Filtro }) => {
          const v = where.vigenciaInicio;
          if (v instanceof Date) return Promise.resolve(null); // "já existe esta data?"
          if (v?.lt) return Promise.resolve(vizinhos.anterior ?? null);
          return Promise.resolve(vizinhos.seguinte ?? null);
        }),
        updateMany: jest.fn(() => {
          ordem.push('fecha-anterior');
          return Promise.resolve({ count: 1 });
        }),
        create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          ordem.push('cria');
          return Promise.resolve({
            ...data,
            valor: { toFixed: () => '1.00' },
            criadoEm: new Date(),
          });
        }),
      },
    };
    const prisma = {
      comTenant: jest.fn((op: (t: typeof tx) => unknown) => op(tx)),
    } as unknown as PrismaService;
    const auditoria = { registrar: jest.fn() } as unknown as AuditoriaService;
    const servico = new ProLaboreService(prisma, {} as FinanceiroService, auditoria);

    return { tx, servico };
  }

  const definir = (servico: ProLaboreService, inicio: string) =>
    runComTenant(CONTEXTO, () => servico.definir({ valor: '1.00', vigenciaInicio: inicio }));

  beforeEach(() => {
    ordem.length = 0;
  });

  it('trava a empresa antes de ler o histórico', async () => {
    const { servico, tx } = montar({});

    await definir(servico, '2026-10-01');

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(ordem[0]).toBe('lock');
  });

  it('a mais recente fica aberta, e a anterior fecha um dia antes', async () => {
    const { servico, tx } = montar({ anterior: { id: 'ant' } });

    await definir(servico, '2026-10-01');

    expect(tx.proLabore.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'ant',
        OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: dia('2026-10-01') } }],
      },
      data: { vigenciaFim: dia('2026-09-30') },
    });
    expect(tx.proLabore.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ vigenciaFim: null }),
    });
  });

  it('data retroativa (o caso do dado real): a nova fecha antes da seguinte, e não fica aberta', async () => {
    // Já existia uma vigência de 01/10; cadastram 01/09, anterior à atual.
    const { servico, tx } = montar({ seguinte: { vigenciaInicio: dia('2026-10-01') } });

    await definir(servico, '2026-09-01');

    expect(tx.proLabore.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ vigenciaFim: dia('2026-09-30') }),
    });
  });

  it('entre duas vigências: encurta a anterior e termina antes da seguinte', async () => {
    const { servico, tx } = montar({
      anterior: { id: 'ant' },
      seguinte: { vigenciaInicio: dia('2026-10-01') },
    });

    await definir(servico, '2026-07-01');

    expect(tx.proLabore.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { vigenciaFim: dia('2026-06-30') } }),
    );
    expect(tx.proLabore.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ vigenciaFim: dia('2026-09-30') }),
    });
  });

  it('o primeiro pró-labore da empresa nasce aberto, sem fechar ninguém', async () => {
    const { servico, tx } = montar({});

    await definir(servico, '2026-01-01');

    expect(tx.proLabore.updateMany).not.toHaveBeenCalled();
    expect(tx.proLabore.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ vigenciaFim: null }),
    });
  });
});
