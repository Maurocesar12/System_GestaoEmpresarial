import { Prisma } from '../../generated/prisma/client';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { AuditoriaService } from '../plataforma/auditoria/auditoria.service';
import type { FinanceiroService } from './financeiro.service';
import { ReservasService } from './reservas.service';

const ID = '0198f1a0-0000-7000-8000-0000000000aa';

const reserva = (saldo: string) => ({
  id: ID,
  tenantId: 't1',
  nome: 'Emergência',
  valorAtual: new Prisma.Decimal(saldo),
  meta: null,
  criadoEm: new Date('2026-01-01'),
  atualizadoEm: new Date('2026-01-01'),
});

describe('ReservasService — saldo sob concorrência', () => {
  const tx = {
    reservaFinanceira: {
      updateMany: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  const prisma = {
    comTenant: jest.fn((op: (t: typeof tx) => unknown) => op(tx)),
  } as unknown as PrismaService;
  const registrar = jest.fn();
  const auditoria = { registrar } as unknown as AuditoriaService;
  const servico = new ReservasService(prisma, {} as FinanceiroService, auditoria);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('movimentar', () => {
    it('aporte soma no banco (increment), sem ler o saldo antes', async () => {
      tx.reservaFinanceira.updateMany.mockResolvedValue({ count: 1 });
      tx.reservaFinanceira.findUniqueOrThrow.mockResolvedValue(reserva('1500.00'));

      const resposta = await servico.movimentar(ID, { tipo: 'aporte', valor: '500.00' });

      expect(tx.reservaFinanceira.updateMany).toHaveBeenCalledWith({
        where: { id: ID },
        data: { valorAtual: { increment: new Prisma.Decimal('500.00') } },
      });
      expect(tx.reservaFinanceira.findUnique).not.toHaveBeenCalled();
      expect(resposta.valorAtual).toBe('1500.00');
    });

    it('resgate só casa se houver saldo, na mesma instrução do UPDATE', async () => {
      tx.reservaFinanceira.updateMany.mockResolvedValue({ count: 1 });
      tx.reservaFinanceira.findUniqueOrThrow.mockResolvedValue(reserva('700.00'));

      await servico.movimentar(ID, { tipo: 'resgate', valor: '300.00' });

      expect(tx.reservaFinanceira.updateMany).toHaveBeenCalledWith({
        where: { id: ID, valorAtual: { gte: new Prisma.Decimal('300.00') } },
        data: { valorAtual: { decrement: new Prisma.Decimal('300.00') } },
      });
      // A auditoria guarda o saldo de antes (700 + 300), não o de depois duas vezes.
      expect(registrar).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          antes: expect.objectContaining({ valorAtual: '1000.00' }),
          depois: expect.objectContaining({ valorAtual: '700.00' }),
        }),
      );
    });

    it('perdeu a corrida pelo saldo: recusa com o saldo real, não grava nada', async () => {
      tx.reservaFinanceira.updateMany.mockResolvedValue({ count: 0 });
      tx.reservaFinanceira.findUnique.mockResolvedValue({
        valorAtual: new Prisma.Decimal('100.00'),
      });

      await expect(
        servico.movimentar(ID, { tipo: 'resgate', valor: '300.00' }),
      ).rejects.toMatchObject({
        status: 400,
        response: { mensagem: expect.stringContaining('R$ 100.00') },
      });
      expect(registrar).not.toHaveBeenCalled();
    });

    it('reserva inexistente: 404', async () => {
      tx.reservaFinanceira.updateMany.mockResolvedValue({ count: 0 });
      tx.reservaFinanceira.findUnique.mockResolvedValue(null);

      await expect(
        servico.movimentar(ID, { tipo: 'aporte', valor: '10.00' }),
      ).rejects.toMatchObject({
        status: 404,
      });
    });

    it.each(['-100.00', '0.00'])('valor %s é recusado antes de tocar no banco', async (valor) => {
      await expect(servico.movimentar(ID, { tipo: 'resgate', valor })).rejects.toMatchObject({
        status: 400,
      });
      expect(tx.reservaFinanceira.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('atualizar', () => {
    it('só grava se o saldo ainda é o que foi lido', async () => {
      tx.reservaFinanceira.findUnique.mockResolvedValue({ id: ID });
      tx.reservaFinanceira.findUniqueOrThrow.mockResolvedValue(reserva('1000.00'));
      tx.reservaFinanceira.findFirst.mockResolvedValue(null);
      tx.reservaFinanceira.update.mockResolvedValue(reserva('2000.00'));

      await servico.atualizar(ID, { nome: 'Emergência', valorAtual: '2000.00', meta: null });

      expect(tx.reservaFinanceira.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ID, valorAtual: new Prisma.Decimal('1000.00') },
        }),
      );
    });

    it('um aporte entrou no meio: 409, em vez de apagá-lo', async () => {
      tx.reservaFinanceira.findUnique.mockResolvedValue({ id: ID });
      tx.reservaFinanceira.findUniqueOrThrow.mockResolvedValue(reserva('1000.00'));
      tx.reservaFinanceira.findFirst.mockResolvedValue(null);
      tx.reservaFinanceira.update.mockRejectedValue(
        Object.assign(new Error('x'), { code: 'P2025' }),
      );

      await expect(
        servico.atualizar(ID, { nome: 'Emergência', valorAtual: '2000.00', meta: null }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('saldo negativo é recusado', async () => {
      await expect(
        servico.atualizar(ID, { nome: 'Emergência', valorAtual: '-1.00', meta: null }),
      ).rejects.toMatchObject({ status: 400 });
    });
  });

  it('criar com saldo negativo é recusado', async () => {
    await expect(
      servico.criar({ nome: 'Emergência', valorAtual: '-5.00', meta: null }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
