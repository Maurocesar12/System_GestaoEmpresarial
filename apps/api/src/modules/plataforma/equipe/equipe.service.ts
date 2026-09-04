import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import {
  CODIGOS_ERRO,
  permissoesDoUsuario,
  type AceitarConviteInput,
  type AtualizarFuncionarioInput,
  type ConviteEquipeInput,
  type EquipeResponse,
  type Funcionario,
  type SessaoResponse,
} from '@gestao/shared-types';
import { uuidv7 } from '../../../common/uuid';
import type { Env } from '../../../config/env.schema';
import { Notificador } from '../../../infra/notificacoes/notificador';
import { PrismaService, type TransacaoComTenant } from '../../../infra/prisma/prisma.service';
import { exigirContextoTenant, tenantAtual } from '../../../infra/tenant/tenant-context';
import { AuthService } from '../../auth/auth.service';
import { RefreshTokenService } from '../../auth/refresh-token.service';
import { SenhaService } from '../../auth/senha.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { calcularMensalidade } from '../planos/calcular-mensalidade';

interface TokenConvite {
  tipo: 'convite-equipe';
  conviteId: string;
  tenantId: string;
}

@Injectable()
export class EquipeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly notificador: Notificador,
    private readonly senhas: SenhaService,
    private readonly auth: AuthService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(): Promise<EquipeResponse> {
    const { funcionarios, convites, tenant } = await this.prisma.comTenant((tx) =>
      Promise.all([
        tx.usuario.findMany({ orderBy: { criadoEm: 'asc' } }),
        tx.conviteEquipe.findMany({
          where: { expiraEm: { gt: new Date() } },
          orderBy: { criadoEm: 'desc' },
        }),
        tx.tenant.findUniqueOrThrow({ where: { id: tenantAtual() }, include: { plano: true } }),
      ]).then(([funcionarios, convites, tenant]) => ({ funcionarios, convites, tenant })),
    );

    const usuariosAtivos = funcionarios.filter((item) => item.ativo).length;
    const ocupadas = usuariosAtivos + convites.length;
    const limite = tenant.plano.limiteUsuarios;
    const cobranca = calcularMensalidade({
      precoBase: tenant.plano.preco,
      usuariosAtivos,
      usuariosInclusos: tenant.plano.usuariosInclusos,
      precoUsuarioAdicional: tenant.plano.precoUsuarioAdicional,
    });

    return {
      funcionarios: funcionarios.map((item) => this.paraFuncionario(item)),
      convites: convites.map((item) => ({
        id: item.id,
        nome: item.nome,
        email: item.email,
        papel: item.papel,
        permissoes: permissoesDoUsuario(item.papel, item.permissoes),
        expiraEm: item.expiraEm.toISOString(),
        criadoEm: item.criadoEm.toISOString(),
      })),
      capacidade: {
        planoNome: tenant.plano.nome,
        limiteUsuarios: limite,
        usuariosAtivos,
        convitesPendentes: convites.length,
        vagasDisponiveis: limite === null ? null : Math.max(0, limite - ocupadas),
        usuariosInclusos: tenant.plano.usuariosInclusos,
        usuariosAdicionais: cobranca.usuariosAdicionais,
        precoPorUsuarioAdicional: tenant.plano.precoUsuarioAdicional.toFixed(2),
        mensalidadeEstimada: cobranca.mensalidade.toFixed(2),
      },
    };
  }

  async convidar(dados: ConviteEquipeInput): Promise<void> {
    await this.garantirEmailDisponivel(dados.email);

    const tenantId = tenantAtual();
    const permissoes = dados.permissoes ?? permissoesDoUsuario(dados.papel, undefined);
    const conviteId = uuidv7();
    const token = this.jwt.sign(
      { tipo: 'convite-equipe', conviteId, tenantId } satisfies TokenConvite,
      { expiresIn: '7d' },
    );
    const tokenHash = this.hash(token);

    const empresa = await this.prisma.comTenant(async (tx) => {
      const plano = await this.garantirVaga(tx, tenantId, dados.email);

      await tx.conviteEquipe.deleteMany({ where: { email: dados.email } });
      await tx.conviteEquipe.create({
        data: {
          id: conviteId,
          tenantId,
          nome: dados.nome,
          email: dados.email,
          papel: dados.papel,
          permissoes,
          tokenHash,
          expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      await this.auditoria.registrar(tx, {
        entidade: 'funcionario',
        entidadeId: conviteId,
        acao: 'convidou',
        depois: { nome: dados.nome, email: dados.email, papel: dados.papel },
      });
      return plano.nome;
    });

    const url = `${this.config.get('APP_URL', { infer: true })}/aceitar-convite?token=${encodeURIComponent(token)}`;
    await this.notificador.enviar({
      destinatario: dados.email,
      assunto: `Convite para participar de ${empresa}`,
      corpo: `Olá, ${dados.nome}. Você foi convidado para acessar ${empresa}.\n\nAceite o convite em até 7 dias:\n${url}\n\nSe não esperava este convite, ignore esta mensagem.`,
    });
  }

  async atualizar(id: string, dados: AtualizarFuncionarioInput): Promise<Funcionario> {
    const atualId = exigirContextoTenant().usuarioId;
    const usuario = await this.prisma.comTenant(async (tx) => {
      const atual = await tx.usuario.findUnique({ where: { id } });
      if (!atual) this.naoEncontrado();
      if (id === atualId && !dados.ativo) {
        throw new ConflictException({
          codigo: CODIGOS_ERRO.CONFLITO,
          mensagem: 'Você não pode desativar seu próprio acesso.',
        });
      }
      if (atual.papel === 'admin' && (dados.papel !== 'admin' || !dados.ativo)) {
        const admins = await tx.usuario.count({ where: { papel: 'admin', ativo: true } });
        if (admins <= 1)
          this.conflito('A empresa precisa manter pelo menos um administrador ativo.');
      }
      if (!atual.ativo && dados.ativo) await this.garantirVaga(tx, tenantAtual());

      const alterado = await tx.usuario.update({
        where: { id },
        data: {
          nome: dados.nome,
          papel: dados.papel,
          ativo: dados.ativo,
          permissoes: dados.permissoes,
          permissoesPersonalizadas: true,
        },
      });
      if (
        !dados.ativo ||
        atual.papel !== dados.papel ||
        JSON.stringify(atual.permissoes) !== JSON.stringify(dados.permissoes)
      ) {
        await this.refreshTokens.revogarTodasAsSessoes(tenantAtual(), id);
      }
      await this.auditoria.registrar(tx, {
        entidade: 'funcionario',
        entidadeId: id,
        acao: dados.ativo ? 'alterou' : 'desativou',
        antes: {
          nome: atual.nome,
          papel: atual.papel,
          ativo: atual.ativo,
          permissoes: atual.permissoes,
        },
        depois: {
          nome: alterado.nome,
          papel: alterado.papel,
          ativo: alterado.ativo,
          permissoes: alterado.permissoes,
        },
      });
      return alterado;
    });
    return this.paraFuncionario(usuario);
  }

  async cancelarConvite(id: string): Promise<void> {
    const removido = await this.prisma.comTenant(async (tx) => {
      const convite = await tx.conviteEquipe.findUnique({ where: { id } });
      if (!convite) return false;
      await tx.conviteEquipe.delete({ where: { id } });
      await this.auditoria.registrar(tx, {
        entidade: 'convite',
        entidadeId: id,
        acao: 'excluiu',
        antes: { email: convite.email },
      });
      return true;
    });
    if (!removido) this.naoEncontrado('Convite não encontrado.');
  }

  async aceitar(dados: AceitarConviteInput): Promise<SessaoResponse> {
    let payload: TokenConvite;
    try {
      payload = this.jwt.verify<TokenConvite>(dados.token);
      if (payload.tipo !== 'convite-equipe') throw new Error('tipo inválido');
    } catch {
      throw new ForbiddenException({
        codigo: CODIGOS_ERRO.SEM_PERMISSAO,
        mensagem: 'Este convite é inválido ou expirou.',
      });
    }

    const convite = await this.prisma.comTenantExplicito(payload.tenantId, async (tx) => {
      const convite = await tx.conviteEquipe.findUnique({ where: { id: payload.conviteId } });
      if (
        !convite ||
        convite.tokenHash !== this.hash(dados.token) ||
        convite.expiraEm <= new Date()
      ) {
        throw new ForbiddenException({
          codigo: CODIGOS_ERRO.SEM_PERMISSAO,
          mensagem: 'Este convite é inválido ou expirou.',
        });
      }
      return convite;
    });

    await this.garantirEmailDisponivel(convite.email);
    const senhaHash = await this.senhas.gerarHash(dados.senha);

    let criado;
    try {
      criado = await this.prisma.comTenantExplicito(payload.tenantId, async (tx) => {
        const conviteAtual = await tx.conviteEquipe.findUnique({
          where: { id: payload.conviteId },
        });
        if (
          !conviteAtual ||
          conviteAtual.tokenHash !== this.hash(dados.token) ||
          conviteAtual.expiraEm <= new Date()
        ) {
          throw new ForbiddenException({
            codigo: CODIGOS_ERRO.SEM_PERMISSAO,
            mensagem: 'Este convite é inválido ou expirou.',
          });
        }
        await this.garantirVaga(tx, payload.tenantId);
        const empresa = await tx.tenant.findUniqueOrThrow({ where: { id: payload.tenantId } });
        const usuario = await tx.usuario.create({
          data: {
            id: uuidv7(),
            tenantId: payload.tenantId,
            nome: dados.nome,
            email: conviteAtual.email,
            senhaHash,
            papel: conviteAtual.papel,
            permissoes: conviteAtual.permissoes,
            permissoesPersonalizadas: true,
          },
        });
        await tx.conviteEquipe.delete({ where: { id: conviteAtual.id } });
        return { usuario, empresa };
      });
    } catch (erro) {
      if (this.eConflitoUnico(erro)) this.conflito('Este e-mail já possui acesso.');
      throw erro;
    }

    return this.auth.montarSessao({
      id: criado.usuario.id,
      nome: criado.usuario.nome,
      email: criado.usuario.email,
      papel: criado.usuario.papel,
      permissoes: permissoesDoUsuario(criado.usuario.papel, criado.usuario.permissoes),
      tenantId: criado.usuario.tenantId,
      nomeEmpresa: criado.empresa.nome,
    });
  }

  private paraFuncionario(usuario: {
    id: string;
    nome: string;
    email: string;
    papel: 'admin' | 'financeiro' | 'atendente' | 'tecnico';
    ativo: boolean;
    permissoes: string[];
    permissoesPersonalizadas: boolean;
    ultimoLoginEm: Date | null;
    criadoEm: Date;
  }): Funcionario {
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
      ativo: usuario.ativo,
      permissoes: permissoesDoUsuario(
        usuario.papel,
        usuario.permissoesPersonalizadas ? usuario.permissoes : undefined,
      ),
      permissoesPersonalizadas: usuario.permissoesPersonalizadas,
      ultimoLoginEm: usuario.ultimoLoginEm?.toISOString() ?? null,
      criadoEm: usuario.criadoEm.toISOString(),
    };
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
  private async garantirEmailDisponivel(email: string): Promise<void> {
    const existente = await this.prisma.semTenant(
      'impedir e-mail duplicado ao convidar ou aceitar funcionário',
      (db) => db.usuario.findUnique({ where: { email }, select: { id: true } }),
    );
    if (existente) this.conflito('Este e-mail já possui acesso ao sistema.');
  }
  /**
   * Reserva e confere uma vaga do plano sob a mesma trava do tenant.
   *
   * Ao convidar, convites válidos também ocupam vaga. Na aceitação e na
   * reativação contamos somente usuários ativos, pois a vaga daquele convite
   * já estava reservada e será consumida na mesma transação.
   */
  private async garantirVaga(
    tx: TransacaoComTenant,
    tenantId: string,
    emailDoConvite?: string,
  ): Promise<{ nome: string }> {
    await tx.$executeRaw`SELECT id FROM tenant WHERE id = ${tenantId}::uuid FOR UPDATE`;

    const [tenant, ativos, convitesPendentes] = await Promise.all([
      tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, include: { plano: true } }),
      tx.usuario.count({ where: { ativo: true } }),
      emailDoConvite
        ? tx.conviteEquipe.count({
            where: { email: { not: emailDoConvite }, expiraEm: { gt: new Date() } },
          })
        : Promise.resolve(0),
    ]);
    const ocupadas = ativos + convitesPendentes;

    if (tenant.plano.limiteUsuarios !== null && ocupadas >= tenant.plano.limiteUsuarios) {
      throw new ForbiddenException({
        codigo: CODIGOS_ERRO.LIMITE_PLANO_EXCEDIDO,
        mensagem: 'O limite de usuários do plano foi atingido.',
      });
    }

    return { nome: tenant.nome };
  }
  private eConflitoUnico(erro: unknown): boolean {
    return typeof erro === 'object' && erro !== null && 'code' in erro && erro.code === 'P2002';
  }
  private conflito(mensagem: string): never {
    throw new ConflictException({ codigo: CODIGOS_ERRO.CONFLITO, mensagem });
  }
  private naoEncontrado(mensagem = 'Funcionário não encontrado.'): never {
    throw new NotFoundException({ codigo: CODIGOS_ERRO.NAO_ENCONTRADO, mensagem });
  }
}
