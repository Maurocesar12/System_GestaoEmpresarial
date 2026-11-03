import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../../infra/prisma/prisma.service';
import { ServicosService } from './servicos.service';

const ID = '0198f1a0-0000-7000-8000-0000000000a1';
const nenhumaLinha = () => Object.assign(new Error('Record not found'), { code: 'P2025' });

const dados = {
  nome: 'Limpeza',
  categoria: null,
  custoBase: '10.00',
  precoPadrao: '50.00',
  ativo: true,
};

const registro = (versao: number) => ({
  id: ID,
  nome: 'Limpeza',
  categoria: null,
  custoBase: { toFixed: () => '10.00', toString: () => '10' },
  precoPadrao: { toFixed: () => '50.00', toString: () => '50' },
  ativo: true,
  versao,
  criadoEm: new Date('2026-01-01'),
});

describe('ServicosService — controle otimista (If-Match)', () => {
  const tx = { servico: { findUnique: jest.fn(), update: jest.fn() } };
  const prisma = {
    comTenant: jest.fn((op: (t: typeof tx) => unknown) => op(tx)),
  } as unknown as PrismaService;
  const servico = new ServicosService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    tx.servico.findUnique.mockResolvedValue({ nome: 'Limpeza' });
  });

  it('com a versão da tela, o where a exige e a gravação sobe a versão', async () => {
    tx.servico.update.mockResolvedValue(registro(4));

    const resposta = await servico.atualizar(ID, dados, 3);

    expect(tx.servico.update).toHaveBeenCalledWith({
      where: { id: ID, versao: 3 },
      data: { ...dados, versao: { increment: 1 } },
    });
    expect(resposta.versao).toBe(4);
  });

  it('a versão velha perde: o where não casa e vira 409, sem sobrescrever', async () => {
    tx.servico.update.mockRejectedValue(nenhumaLinha());

    await expect(servico.atualizar(ID, dados, 2)).rejects.toBeInstanceOf(ConflictException);
    await expect(servico.atualizar(ID, dados, 2)).rejects.toMatchObject({
      response: { mensagem: expect.stringContaining('alterado por outra pessoa') },
    });
  });

  it('sem versão (cliente antigo), não confere nada, mas sobe a versão', async () => {
    tx.servico.update.mockResolvedValue(registro(2));

    await servico.atualizar(ID, dados);

    expect(tx.servico.update).toHaveBeenCalledWith({
      where: { id: ID },
      data: { ...dados, versao: { increment: 1 } },
    });
  });

  it('desativar sobe a versão: a tela de edição aberta antes não o reativa ao salvar', async () => {
    tx.servico.findUnique.mockResolvedValue({ id: ID });
    tx.servico.update.mockResolvedValue({ ...registro(5), ativo: false });

    await servico.desativar(ID);

    expect(tx.servico.update).toHaveBeenCalledWith({
      where: { id: ID },
      data: { ativo: false, versao: { increment: 1 } },
    });
  });
});
