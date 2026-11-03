import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../../infra/prisma/prisma.service';
import type { AuditoriaService } from '../../plataforma/auditoria/auditoria.service';
import type { FunilService } from '../funil/funil.service';
import { ClientesService } from './clientes.service';

const ID = '0198f1a0-0000-7000-8000-0000000000b1';
const nenhumaLinha = () => Object.assign(new Error('Record not found'), { code: 'P2025' });

const dados = {
  nome: 'Maria',
  email: null,
  telefone: null,
  documento: null,
  observacoes: null,
  origem: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  camposPersonalizados: {},
  etiquetas: [],
};

describe('ClientesService.atualizar — controle otimista (If-Match)', () => {
  const tx = {
    cliente: { findUnique: jest.fn(), update: jest.fn() },
    campoPersonalizado: { findMany: jest.fn() },
  };
  const prisma = {
    comTenant: jest.fn((op: (t: typeof tx) => unknown) => op(tx)),
  } as unknown as PrismaService;
  const servico = new ClientesService(
    prisma,
    {} as FunilService,
    { registrar: jest.fn() } as unknown as AuditoriaService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    tx.cliente.findUnique.mockResolvedValue({ id: ID, anonimizadoEm: null, etiquetas: [] });
    tx.campoPersonalizado.findMany.mockResolvedValue([]);
    tx.cliente.update.mockRejectedValue(nenhumaLinha());
  });

  it('a versão da tela vai no where e a gravação sobe a versão', async () => {
    await servico.atualizar(ID, dados, 7).catch(() => undefined);

    expect(tx.cliente.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ID, versao: 7 },
        data: expect.objectContaining({ nome: 'Maria', versao: { increment: 1 } }),
      }),
    );
  });

  it('a versão velha vira 409 e as etiquetas não são regravadas', async () => {
    await expect(servico.atualizar(ID, dados, 6)).rejects.toBeInstanceOf(ConflictException);
  });

  it('sem versão, o where só leva o id', async () => {
    await servico.atualizar(ID, dados).catch(() => undefined);

    expect(tx.cliente.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ID } }));
  });

  it('nunca grava uma "versao" vinda dos dados: só o incremento do servidor', async () => {
    await servico
      .atualizar(ID, { ...dados, versao: 999 } as typeof dados, 7)
      .catch(() => undefined);

    const { data } = tx.cliente.update.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(data.versao).toEqual({ increment: 1 });
  });
});
