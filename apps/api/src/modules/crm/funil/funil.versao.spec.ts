import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../../infra/prisma/prisma.service';
import type { AuditoriaService } from '../../plataforma/auditoria/auditoria.service';
import { FunilService } from './funil.service';

const ID = '0198f1a0-0000-7000-8000-0000000000d1';
const nenhumaLinha = () => Object.assign(new Error('Record not found'), { code: 'P2025' });

describe('FunilService.renomearEtapa — controle otimista (If-Match)', () => {
  const tx = { etapaFunil: { findUnique: jest.fn(), update: jest.fn() } };
  const servico = new FunilService(
    { comTenant: jest.fn((op: (t: typeof tx) => unknown) => op(tx)) } as unknown as PrismaService,
    { registrar: jest.fn() } as unknown as AuditoriaService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    tx.etapaFunil.findUnique.mockResolvedValue({ id: ID });
  });

  it('a versão da tela vai no where, a gravação a sobe e a resposta a devolve', async () => {
    tx.etapaFunil.update.mockResolvedValue({ id: ID, nome: 'Proposta', ordem: 2, versao: 6 });

    const etapa = await servico.renomearEtapa(ID, { nome: 'Proposta' }, 5);

    expect(tx.etapaFunil.update).toHaveBeenCalledWith({
      where: { id: ID, versao: 5 },
      data: { nome: 'Proposta', versao: { increment: 1 } },
    });
    expect(etapa).toEqual({ id: ID, nome: 'Proposta', ordem: 2, versao: 6 });
  });

  it('a versão velha vira 409', async () => {
    tx.etapaFunil.update.mockRejectedValue(nenhumaLinha());

    await expect(servico.renomearEtapa(ID, { nome: 'Proposta' }, 4)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('sem versão, o where só leva o id', async () => {
    tx.etapaFunil.update.mockResolvedValue({ id: ID, nome: 'Proposta', ordem: 2, versao: 2 });

    await servico.renomearEtapa(ID, { nome: 'Proposta' });

    expect(tx.etapaFunil.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ID } }),
    );
  });
});
