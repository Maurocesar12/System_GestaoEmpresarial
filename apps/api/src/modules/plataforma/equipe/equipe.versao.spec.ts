import { ConflictException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../../../infra/prisma/prisma.service';
import type { Notificador } from '../../../infra/notificacoes/notificador';
import { runComTenant, type TenantContext } from '../../../infra/tenant/tenant-context';
import type { AuthService } from '../../auth/auth.service';
import type { RefreshTokenService } from '../../auth/refresh-token.service';
import type { SenhaService } from '../../auth/senha.service';
import type { AuditoriaService } from '../auditoria/auditoria.service';
import { EquipeService } from './equipe.service';

const ID = '0198f1a0-0000-7000-8000-0000000000e1';
const nenhumaLinha = () => Object.assign(new Error('Record not found'), { code: 'P2025' });

const contexto: TenantContext = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  usuarioId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  papel: 'admin',
  requestId: 'req-teste',
};

const dados = { nome: 'Ana', papel: 'tecnico', ativo: true, acessos: {} } as never;

const usuario = (versao: number) => ({
  id: ID,
  versao,
  nome: 'Ana',
  email: 'ana@exemplo.com',
  papel: 'tecnico' as const,
  ativo: true,
  permissoes: [] as string[],
  permissoesPersonalizadas: false,
  comissaoVendaPercentual: null,
  comissaoExecucaoPercentual: null,
  ultimoLoginEm: null,
  doisFatoresAtivadoEm: null,
  criadoEm: new Date('2026-01-01'),
});

describe('EquipeService.atualizar — controle otimista (If-Match)', () => {
  const tx = { usuario: { findFirst: jest.fn(), update: jest.fn(), count: jest.fn() } };
  const revogarTodasAsSessoes = jest.fn();

  const servico = new EquipeService(
    { comTenant: jest.fn((op: (t: typeof tx) => unknown) => op(tx)) } as unknown as PrismaService,
    {} as JwtService,
    {} as ConfigService<never, true>,
    {} as Notificador,
    {} as SenhaService,
    {} as AuthService,
    { revogarTodasAsSessoes } as unknown as RefreshTokenService,
    { registrar: jest.fn() } as unknown as AuditoriaService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    tx.usuario.findFirst.mockResolvedValue(usuario(3));
  });

  const atualizar = (versao?: number) =>
    runComTenant(contexto, () => servico.atualizar(ID, dados, versao));

  it('a versão da tela vai no where e a gravação a sobe', async () => {
    tx.usuario.update.mockResolvedValue(usuario(4));

    const funcionario = await atualizar(3);

    expect(tx.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ID, versao: 3 },
        data: expect.objectContaining({ versao: { increment: 1 } }),
      }),
    );
    expect(funcionario.versao).toBe(4);
  });

  it('a versão velha vira 409, e as sessões da pessoa não são derrubadas', async () => {
    tx.usuario.update.mockRejectedValue(nenhumaLinha());

    await expect(atualizar(2)).rejects.toBeInstanceOf(ConflictException);
    expect(revogarTodasAsSessoes).not.toHaveBeenCalled();
  });

  it('sem versão, o where só leva o id', async () => {
    tx.usuario.update.mockResolvedValue(usuario(4));

    await atualizar();

    expect(tx.usuario.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ID } }));
  });
});
