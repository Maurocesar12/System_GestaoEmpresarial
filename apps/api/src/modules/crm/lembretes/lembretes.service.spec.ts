import { BadRequestException, ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../../infra/prisma/prisma.service';
import { LembretesService } from './lembretes.service';

const ID = '0198f1a0-0000-7000-8000-0000000000f1';
const nenhumaLinha = () => Object.assign(new Error('Record not found'), { code: 'P2025' });

const linha = (status: 'pendente' | 'enviando' | 'enviado' | 'cancelado') => ({
  id: ID,
  clienteId: '0198f1a0-0000-7000-8000-0000000000f2',
  canal: 'email' as const,
  status,
  dataEnvio: new Date('2026-11-04T12:00:00.000Z'),
  enviadoEm: null,
  erro: null,
  criadoEm: new Date('2026-11-03T12:00:00.000Z'),
  cliente: { nome: 'Maria', email: 'maria@exemplo.com', telefone: null },
});

describe('LembretesService.cancelar', () => {
  const tx = { lembreteFollowUp: { findUnique: jest.fn(), update: jest.fn() } };
  const servico = new LembretesService({
    comTenant: jest.fn((op: (t: typeof tx) => unknown) => op(tx)),
  } as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cancela um lembrete pendente, e só enquanto ele segue pendente', async () => {
    tx.lembreteFollowUp.findUnique.mockResolvedValue(linha('pendente'));
    tx.lembreteFollowUp.update.mockResolvedValue(linha('cancelado'));

    const resposta = await servico.cancelar(ID);

    expect(tx.lembreteFollowUp.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ID, status: 'pendente' } }),
    );
    expect(resposta.status).toBe('cancelado');
  });

  it('um lembrete que o worker já está enviando não pode mais ser cancelado', async () => {
    // O e-mail pode já ter saído: "cancelado" na tela seria mentira.
    tx.lembreteFollowUp.findUnique.mockResolvedValue(linha('enviando'));

    await expect(servico.cancelar(ID)).rejects.toBeInstanceOf(BadRequestException);
    await expect(servico.cancelar(ID)).rejects.toMatchObject({
      response: { mensagem: expect.stringContaining('sendo enviado agora') },
    });
    expect(tx.lembreteFollowUp.update).not.toHaveBeenCalled();
  });

  it('o worker reivindicou entre a leitura e a gravação: 409, e nada é cancelado', async () => {
    // Leu "pendente"; quando o UPDATE roda, o lembrete já é "enviando".
    tx.lembreteFollowUp.findUnique.mockResolvedValue(linha('pendente'));
    tx.lembreteFollowUp.update.mockRejectedValue(nenhumaLinha());

    await expect(servico.cancelar(ID)).rejects.toBeInstanceOf(ConflictException);
    await expect(servico.cancelar(ID)).rejects.toMatchObject({
      response: { mensagem: expect.stringContaining('já está sendo enviado') },
    });
  });

  it('lembrete já enviado continua sem poder ser cancelado', async () => {
    tx.lembreteFollowUp.findUnique.mockResolvedValue(linha('enviado'));

    await expect(servico.cancelar(ID)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.lembreteFollowUp.update).not.toHaveBeenCalled();
  });
});
