import { ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { PERMISSOES_PADRAO_POR_PAPEL, type Permissao } from '@gestao/shared-types';
import type { PrismaService } from '../../../infra/prisma/prisma.service';
import type { Notificador } from '../../../infra/notificacoes/notificador';
import { runComTenant, type TenantContext } from '../../../infra/tenant/tenant-context';
import type { AuthService } from '../../auth/auth.service';
import type { RefreshTokenService } from '../../auth/refresh-token.service';
import type { SenhaService } from '../../auth/senha.service';
import type { AuditoriaService } from '../auditoria/auditoria.service';
import { EquipeService } from './equipe.service';

/**
 * Quem gerencia a equipe sem ser administrador não amplia acesso.
 *
 * O ataque: um funcionário com o extra "Gerenciar equipe" monta à mão um
 * PATCH no próprio cadastro com `papel: 'admin'` — ou convida um cúmplice
 * como admin. A tela não oferece isso; a API precisa recusar.
 */
const GERENTE = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const OUTRO = '0198f1a0-0000-7000-8000-0000000000e2';

const atendenteQueGerencia: Permissao[] = [
  ...PERMISSOES_PADRAO_POR_PAPEL.atendente,
  'equipe.gerenciar',
];

const contexto = (papel: TenantContext['papel'], permissoes?: Permissao[]): TenantContext => ({
  tenantId: '11111111-1111-1111-1111-111111111111',
  usuarioId: GERENTE,
  papel,
  permissoes,
  requestId: 'req-teste',
});

const usuario = (id: string, papel: 'admin' | 'atendente' | 'tecnico', permissoes?: string[]) => ({
  id,
  versao: 1,
  nome: 'Pessoa',
  email: 'pessoa@exemplo.com',
  papel,
  ativo: true,
  permissoes: permissoes ?? [],
  permissoesPersonalizadas: Boolean(permissoes),
  comissaoVendaPercentual: null,
  comissaoExecucaoPercentual: null,
  ultimoLoginEm: null,
  doisFatoresAtivadoEm: null,
  criadoEm: new Date('2026-01-01'),
});

describe('EquipeService — sem escalada de acesso por quem não é admin', () => {
  const tx = { usuario: { findFirst: jest.fn(), update: jest.fn(), count: jest.fn() } };

  const servico = new EquipeService(
    { comTenant: jest.fn((op: (t: typeof tx) => unknown) => op(tx)) } as unknown as PrismaService,
    { sign: jest.fn(() => 'token') } as unknown as JwtService,
    {} as ConfigService<never, true>,
    {} as Notificador,
    {} as SenhaService,
    {} as AuthService,
    { revogarTodasAsSessoes: jest.fn() } as unknown as RefreshTokenService,
    { registrar: jest.fn() } as unknown as AuditoriaService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    tx.usuario.update.mockImplementation(({ data }: { data: object }) => ({
      ...usuario(OUTRO, 'tecnico'),
      ...data,
      versao: 2,
    }));
  });

  const atualizarComo = (ctx: TenantContext, id: string, dados: object) =>
    runComTenant(ctx, () => servico.atualizar(id, dados as never));

  it('recusa quem se promove a admin no próprio cadastro', async () => {
    tx.usuario.findFirst.mockResolvedValue(usuario(GERENTE, 'atendente', atendenteQueGerencia));

    await expect(
      atualizarComo(contexto('atendente', atendenteQueGerencia), GERENTE, {
        nome: 'Eu',
        papel: 'admin',
        ativo: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.usuario.update).not.toHaveBeenCalled();
  });

  it('recusa promover outra pessoa a admin', async () => {
    tx.usuario.findFirst.mockResolvedValue(usuario(OUTRO, 'tecnico'));

    await expect(
      atualizarComo(contexto('atendente', atendenteQueGerencia), OUTRO, {
        nome: 'Cúmplice',
        papel: 'admin',
        ativo: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.usuario.update).not.toHaveBeenCalled();
  });

  it('recusa mexer na conta de um administrador (rebaixar ou desativar)', async () => {
    tx.usuario.findFirst.mockResolvedValue(usuario(OUTRO, 'admin'));
    tx.usuario.count.mockResolvedValue(2);

    await expect(
      atualizarComo(contexto('atendente', atendenteQueGerencia), OUTRO, {
        nome: 'Dono',
        papel: 'tecnico',
        ativo: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.usuario.update).not.toHaveBeenCalled();
  });

  it('recusa conceder uma permissão que quem concede não tem', async () => {
    tx.usuario.findFirst.mockResolvedValue(usuario(OUTRO, 'tecnico'));

    await expect(
      atualizarComo(contexto('atendente', atendenteQueGerencia), OUTRO, {
        nome: 'Técnico',
        papel: 'tecnico',
        ativo: true,
        acessos: { financeiro: { nivel: 'total', extras: [] } },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.usuario.update).not.toHaveBeenCalled();
  });

  it('recusa convidar alguém como admin', async () => {
    jest.spyOn(servico as never, 'garantirEmailDisponivel').mockResolvedValue(undefined as never);

    await expect(
      runComTenant(contexto('atendente', atendenteQueGerencia), () =>
        servico.convidar({ email: 'novo@exemplo.com', papel: 'admin' } as never),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deixa trocar só o nome de alguém com acesso que ele não tem', async () => {
    const doFinanceiro = [...PERMISSOES_PADRAO_POR_PAPEL.financeiro];
    tx.usuario.findFirst.mockResolvedValue({
      ...usuario(OUTRO, 'tecnico'),
      papel: 'financeiro',
      permissoes: doFinanceiro,
      permissoesPersonalizadas: false,
    });

    await atualizarComo(contexto('atendente', atendenteQueGerencia), OUTRO, {
      nome: 'Nome novo',
      papel: 'financeiro',
      ativo: true,
    });

    expect(tx.usuario.update).toHaveBeenCalled();
  });

  it('o administrador continua promovendo quem quiser', async () => {
    tx.usuario.findFirst.mockResolvedValue(usuario(OUTRO, 'tecnico'));

    await atualizarComo(contexto('admin'), OUTRO, { nome: 'Sócia', papel: 'admin', ativo: true });

    expect(tx.usuario.update).toHaveBeenCalled();
  });
});
