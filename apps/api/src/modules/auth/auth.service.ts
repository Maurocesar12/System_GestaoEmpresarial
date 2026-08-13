import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  CODIGOS_ERRO,
  type JwtPayload,
  type LoginInput,
  type SessaoResponse,
  type UsuarioAutenticado,
} from '@gestao/shared-types';
import type { Env } from '../../config/env.schema';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RefreshTokenService } from './refresh-token.service';
import { SenhaService } from './senha.service';

/**
 * Login, renovação de sessão e logout.
 *
 * O fluxo completo: o usuário manda e-mail e senha, recebe de volta um access
 * token (curto) e um refresh token (longo). O access token acompanha cada
 * requisição; quando expira, o refresh token pede outro sem incomodar o
 * usuário.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly senhas: SenhaService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async login({ email, senha }: LoginInput): Promise<SessaoResponse> {
    // Busca fora de escopo de tenant porque é justamente o login que descobre
    // a qual empresa a pessoa pertence. É o que a política `usuario_login`
    // permite — e só ela: a tabela `tenant` continua isolada, por isso não há
    // `include` aqui. A empresa é lida logo abaixo, já dentro do contexto.
    const usuario = await this.prisma.semTenant('identificar o usuário pelo e-mail', (db) =>
      db.usuario.findFirst({ where: { email } }),
    );

    if (!usuario) {
      // Consome o mesmo tempo de uma conferência real antes de recusar. Sem
      // isso, a diferença de tempo entre "e-mail existe" e "não existe"
      // permitiria mapear quem tem conta no sistema.
      await this.senhas.simularConferencia();
      throw this.credenciaisInvalidas();
    }

    const senhaConfere = await this.senhas.conferir(usuario.senhaHash, senha);

    // A mesma mensagem para senha errada e e-mail inexistente, de propósito:
    // "esse e-mail não existe" entrega ao atacante metade do trabalho.
    if (!senhaConfere) {
      throw this.credenciaisInvalidas();
    }

    if (!usuario.ativo) {
      throw new ForbiddenException({
        codigo: CODIGOS_ERRO.SEM_PERMISSAO,
        mensagem: 'Este usuário está desativado. Fale com o administrador da sua empresa.',
      });
    }

    // A partir daqui já sabemos a empresa, então tudo roda dentro do contexto
    // dela — ler os dados do tenant e registrar o acesso na mesma transação.
    const tenant = await this.prisma.comTenantExplicito(usuario.tenantId, async (tx) => {
      const empresa = await tx.tenant.findUniqueOrThrow({ where: { id: usuario.tenantId } });

      await tx.usuario.update({
        where: { id: usuario.id },
        data: { ultimoLoginEm: new Date() },
      });

      return empresa;
    });

    this.garantirTenantOperante(tenant.status);

    return this.montarSessao({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
      tenantId: usuario.tenantId,
      nomeEmpresa: tenant.nome,
    });
  }

  /** Troca um refresh token por uma sessão nova. */
  async renovar(refreshToken: string): Promise<SessaoResponse> {
    const rotacionado = await this.refreshTokens.rotacionar(refreshToken);

    const usuario = await this.prisma.comTenantExplicito(rotacionado.tenantId, (tx) =>
      tx.usuario.findUnique({
        where: { id: rotacionado.usuarioId },
        include: { tenant: true },
      }),
    );

    // O usuário pode ter sido desativado ou removido depois que o token foi
    // emitido — o token continuaria válido, a conta não.
    if (!usuario || !usuario.ativo) {
      throw this.credenciaisInvalidas();
    }

    this.garantirTenantOperante(usuario.tenant.status);

    return {
      ...this.montarTokens({
        id: usuario.id,
        papel: usuario.papel,
        tenantId: usuario.tenantId,
      }),
      refreshToken: rotacionado.token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        papel: usuario.papel,
        tenantId: usuario.tenantId,
        nomeEmpresa: usuario.tenant.nome,
      },
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokens.revogar(refreshToken);
  }

  /** Emite os tokens e monta a resposta de sessão. */
  async montarSessao(usuario: UsuarioAutenticado): Promise<SessaoResponse> {
    const refreshToken = await this.refreshTokens.emitir(usuario.tenantId, usuario.id);

    return {
      ...this.montarTokens({
        id: usuario.id,
        papel: usuario.papel,
        tenantId: usuario.tenantId,
      }),
      refreshToken,
      usuario,
    };
  }

  private montarTokens(dados: Pick<UsuarioAutenticado, 'id' | 'papel' | 'tenantId'>): {
    accessToken: string;
    expiraEm: number;
  } {
    const minutos = this.config.get('JWT_ACCESS_TTL_MINUTOS', { infer: true });
    const expiraEm = minutos * 60;

    const payload: JwtPayload = {
      sub: dados.id,
      tenantId: dados.tenantId,
      papel: dados.papel,
    };

    return {
      accessToken: this.jwt.sign(payload, { expiresIn: expiraEm }),
      expiraEm,
    };
  }

  /**
   * Barra o acesso de empresa suspensa ou cancelada.
   *
   * `trial` e `ativo` entram normalmente. A suspensão por inadimplência é
   * aplicada aqui e não no meio das telas: é mais simples e não deixa brecha
   * de uma rota esquecida continuar respondendo.
   */
  private garantirTenantOperante(status: string): void {
    if (status === 'suspenso' || status === 'cancelado') {
      throw new ForbiddenException({
        codigo: CODIGOS_ERRO.TENANT_SUSPENSO,
        mensagem:
          status === 'suspenso'
            ? 'Acesso suspenso por pendência no pagamento. Regularize para voltar a usar o sistema.'
            : 'Esta conta foi cancelada.',
      });
    }
  }

  private credenciaisInvalidas(): UnauthorizedException {
    return new UnauthorizedException({
      codigo: CODIGOS_ERRO.NAO_AUTENTICADO,
      mensagem: 'E-mail ou senha incorretos.',
    });
  }
}
