import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import { JANELA_TOLERANCIA_MS, RefreshTokenService } from './refresh-token.service';

const TENANT = '0198f1a0-0000-7000-8000-000000000001';
const USUARIO = '0198f1a0-0000-7000-8000-000000000002';
const TOKEN = `${TENANT}.segredo-antigo`;

type Registro = {
  id: string;
  usuarioId: string;
  expiraEm: Date;
  revogadoEm: Date | null;
  rotacionadoEm: Date | null;
};

const ativo = (): Registro => ({
  id: 'r1',
  usuarioId: USUARIO,
  expiraEm: new Date(Date.now() + 86_400_000),
  revogadoEm: null,
  rotacionadoEm: null,
});

const rotacionadoHa = (ms: number): Registro => {
  const quando = new Date(Date.now() - ms);

  return { ...ativo(), revogadoEm: quando, rotacionadoEm: quando };
};

describe('RefreshTokenService.rotacionar — corrida e janela de tolerância', () => {
  const tx = {
    refreshToken: { findUnique: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
  };
  const prisma = {
    comTenantExplicito: jest.fn((_: string, op: (t: typeof tx) => unknown) => op(tx)),
  } as unknown as PrismaService;
  const config = { get: () => 7 } as unknown as ConfigService<never, true>;
  const servico = new RefreshTokenService(prisma, config);

  /** Chamadas de `updateMany` que derrubam sessões (filtram por usuário). */
  const derrubadas = () =>
    tx.refreshToken.updateMany.mock.calls.filter(
      ([args]) => args.where.usuarioId === USUARIO && args.where.revogadoEm === null,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    tx.refreshToken.updateMany.mockResolvedValue({ count: 1 });
  });

  it('rotação normal: revoga com condição e emite um token novo', async () => {
    tx.refreshToken.findUnique.mockResolvedValue(ativo());

    const resposta = await servico.rotacionar(TOKEN);

    expect(resposta.token).not.toBe(TOKEN);
    expect(resposta.token.startsWith(`${TENANT}.`)).toBe(true);
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', revogadoEm: null },
      data: { revogadoEm: expect.any(Date), rotacionadoEm: expect.any(Date) },
    });
    expect(tx.refreshToken.create).toHaveBeenCalledTimes(1);
  });

  it('perdeu a corrida para outra rotação, dentro da janela: recebe token novo e a sessão segue', async () => {
    tx.refreshToken.findUnique
      .mockResolvedValueOnce(ativo())
      .mockResolvedValueOnce(rotacionadoHa(1_000));
    tx.refreshToken.updateMany.mockResolvedValueOnce({ count: 0 });

    const resposta = await servico.rotacionar(TOKEN);

    expect(resposta.token.startsWith(`${TENANT}.`)).toBe(true);
    // Só o token da emissão: a transação perdedora não cria o dela.
    expect(tx.refreshToken.create).toHaveBeenCalledTimes(1);
    expect(derrubadas()).toHaveLength(0);
  });

  it('token já rotacionado, reapresentado dentro da janela, é aceito', async () => {
    tx.refreshToken.findUnique.mockResolvedValue(rotacionadoHa(JANELA_TOLERANCIA_MS - 5_000));

    await expect(servico.rotacionar(TOKEN)).resolves.toMatchObject({ usuarioId: USUARIO });
    expect(derrubadas()).toHaveLength(0);
  });

  it('fora da janela é reuso: derruba todas as sessões e recusa', async () => {
    tx.refreshToken.findUnique.mockResolvedValue(rotacionadoHa(JANELA_TOLERANCIA_MS + 5_000));

    await expect(servico.rotacionar(TOKEN)).rejects.toBeInstanceOf(UnauthorizedException);

    expect(derrubadas()).toHaveLength(1);
    expect(tx.refreshToken.create).not.toHaveBeenCalled();
  });

  it('token revogado por logout ou derrubada (sem rotacionadoEm) nunca tem tolerância', async () => {
    tx.refreshToken.findUnique.mockResolvedValue({
      ...ativo(),
      revogadoEm: new Date(Date.now() - 1_000),
    });

    await expect(servico.rotacionar(TOKEN)).rejects.toBeInstanceOf(UnauthorizedException);

    expect(tx.refreshToken.create).not.toHaveBeenCalled();
    expect(derrubadas()).toHaveLength(1);
  });

  it('dentro da janela, mas já expirado: recusa', async () => {
    tx.refreshToken.findUnique.mockResolvedValue({
      ...rotacionadoHa(1_000),
      expiraEm: new Date(Date.now() - 1_000),
    });

    await expect(servico.rotacionar(TOKEN)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tx.refreshToken.create).not.toHaveBeenCalled();
  });

  it('token desconhecido é recusado', async () => {
    tx.refreshToken.findUnique.mockResolvedValue(null);

    await expect(servico.rotacionar(TOKEN)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('derrubar as sessões também fecha a janela dos tokens já rotacionados', async () => {
    await servico.revogarTodasAsSessoes(TENANT, USUARIO);

    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { usuarioId: USUARIO, rotacionadoEm: { not: null } },
      data: { rotacionadoEm: null },
    });
  });

  it('sair (logout) fecha a janela, para um token antigo não reabrir a sessão', async () => {
    tx.refreshToken.findUnique.mockResolvedValue({ usuarioId: USUARIO });

    await servico.revogar(`${TENANT}.segredo-atual`);

    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { usuarioId: USUARIO, rotacionadoEm: { not: null } },
      data: { rotacionadoEm: null },
    });
  });
});
