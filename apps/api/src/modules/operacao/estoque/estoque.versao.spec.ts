import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../../infra/prisma/prisma.service';
import type { AuditoriaService } from '../../plataforma/auditoria/auditoria.service';
import { EstoqueService } from './estoque.service';

const ID = '0198f1a0-0000-7000-8000-0000000000c1';
const nenhumaLinha = () => Object.assign(new Error('Record not found'), { code: 'P2025' });

const dados = { nome: 'Gás R410A', unidade: 'kg', estoqueMinimo: null, ativo: true } as never;

const registro = (versao: number) => ({
  id: ID,
  versao,
  nome: 'Gás R410A',
  unidade: 'kg',
  quantidade: {
    toFixed: () => '10.000',
    toString: () => '10',
    lessThan: () => false,
    isNegative: () => false,
  },
  custoMedio: {
    toFixed: () => '5.0000',
    toString: () => '5',
    times: () => ({ toFixed: () => '50.00' }),
  },
  estoqueMinimo: null,
  ativo: true,
  criadoEm: new Date('2026-01-01'),
});

describe('EstoqueService.atualizar — controle otimista (If-Match)', () => {
  const tx = { material: { findUnique: jest.fn(), update: jest.fn() } };
  const servico = new EstoqueService(
    { comTenant: jest.fn((op: (t: typeof tx) => unknown) => op(tx)) } as unknown as PrismaService,
    { registrar: jest.fn() } as unknown as AuditoriaService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    tx.material.findUnique.mockResolvedValue({ nome: 'Gás R410A' });
  });

  it('a versão da tela vai no where e a gravação sobe a versão (sem tocar no saldo)', async () => {
    tx.material.update.mockResolvedValue(registro(4));

    await servico.atualizar(ID, dados, 3).catch(() => undefined);

    expect(tx.material.update).toHaveBeenCalledWith({
      where: { id: ID, versao: 3 },
      data: {
        versao: { increment: 1 },
        nome: 'Gás R410A',
        unidade: 'kg',
        estoqueMinimo: null,
        ativo: true,
      },
    });
  });

  it('a versão velha vira 409', async () => {
    tx.material.update.mockRejectedValue(nenhumaLinha());

    await expect(servico.atualizar(ID, dados, 2)).rejects.toBeInstanceOf(ConflictException);
  });

  it('sem versão, o where só leva o id', async () => {
    tx.material.update.mockResolvedValue(registro(2));

    await servico.atualizar(ID, dados).catch(() => undefined);

    expect(tx.material.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ID } }));
  });
});
