import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  loginSchema,
  refreshTokenSchema,
  type LoginInput,
  type RefreshTokenInput,
  type SessaoResponse,
  type UsuarioAutenticado,
} from '@gestao/shared-types';
import { Publico } from '../../common/decorators/publico.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { TenantContext } from '../../infra/tenant/tenant-context';
import { LIMITE_LOGIN, LIMITE_REFRESH } from './auth.rate-limit';
import { AuthService } from './auth.service';

/**
 * Rotas de sessão.
 *
 * O rate limit aqui é bem mais apertado que o global (arquitetura §9.2): login
 * é o alvo preferido de ataque de força bruta, e 120 tentativas por minuto —
 * o padrão da aplicação — seria um convite.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Publico()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(LIMITE_LOGIN)
  login(@Body(new ZodValidationPipe(loginSchema)) dados: LoginInput): Promise<SessaoResponse> {
    return this.auth.login(dados);
  }

  @Publico()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle(LIMITE_REFRESH)
  renovar(
    @Body(new ZodValidationPipe(refreshTokenSchema)) dados: RefreshTokenInput,
  ): Promise<SessaoResponse> {
    return this.auth.renovar(dados.refreshToken);
  }

  @Publico()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body(new ZodValidationPipe(refreshTokenSchema)) dados: RefreshTokenInput,
  ): Promise<void> {
    // Público de propósito: sair precisa funcionar mesmo com o access token já
    // expirado. O refresh token no corpo é o que identifica a sessão a encerrar.
    await this.auth.logout(dados.refreshToken);
  }

  /**
   * Quem está logado.
   *
   * O frontend chama esta rota ao carregar a aplicação para reconstruir a
   * sessão a partir do cookie, sem guardar dados do usuário no navegador.
   */
  @Get('eu')
  async eu(@UsuarioAtual() contexto: TenantContext): Promise<UsuarioAutenticado> {
    const usuario = await this.prisma.comTenant((tx) =>
      tx.usuario.findUniqueOrThrow({
        where: { id: contexto.usuarioId },
        include: { tenant: { select: { nome: true } } },
      }),
    );

    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
      tenantId: usuario.tenantId,
      nomeEmpresa: usuario.tenant.nome,
    };
  }
}
