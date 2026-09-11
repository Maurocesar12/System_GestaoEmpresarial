import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  CODIGOS_ERRO,
  calcularAcesso,
  mensagemDeAcesso,
  type DadosDeAcesso,
  type JwtPayload,
  type LoginInput,
  type SessaoResponse,
  type SituacaoDeAcesso,
  type StatusTenant,
  type UsuarioAutenticado,
  permissoesDoUsuario,
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
  private readonly logger = new Logger(AuthService.name);

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
      db.usuario.findUnique({
        where: { email },
        select: {
          id: true,
          tenantId: true,
          nome: true,
          email: true,
          senhaHash: true,
          papel: true,
          ativo: true,
          permissoes: true,
          permissoesPersonalizadas: true,
        },
      }),
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

    const tenant = await this.buscarTenantDoLogin(usuario.tenantId);
    const acesso = this.garantirAcessoEmDia(tenant);

    const permissoes = permissoesDoUsuario(
      usuario.papel,
      usuario.permissoesPersonalizadas ? usuario.permissoes : undefined,
    );
    const refreshToken = await this.refreshTokens.emitir(usuario.tenantId, usuario.id);
    this.registrarUltimoLogin(usuario.tenantId, usuario.id);

    return this.montarSessao(
      {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        papel: usuario.papel,
        permissoes,
        tenantId: usuario.tenantId,
        nomeEmpresa: tenant.nome,
      },
      refreshToken,
      acesso,
    );
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

    // Renovar também confere: sem isto, uma aba aberta continuaria trocando
    // token por token indefinidamente depois do vencimento.
    const acesso = this.garantirAcessoEmDia({
      status: usuario.tenant.status,
      trialTerminaEm: usuario.tenant.trialTerminaEm?.toISOString() ?? null,
      ultimoPagamentoEm: usuario.tenant.ultimoPagamentoEm?.toISOString() ?? null,
    });

    return {
      ...this.montarTokens({
        id: usuario.id,
        papel: usuario.papel,
        permissoes: permissoesDoUsuario(
          usuario.papel,
          usuario.permissoesPersonalizadas ? usuario.permissoes : undefined,
        ),
        tenantId: usuario.tenantId,
      }),
      refreshToken: rotacionado.token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        papel: usuario.papel,
        permissoes: permissoesDoUsuario(
          usuario.papel,
          usuario.permissoesPersonalizadas ? usuario.permissoes : undefined,
        ),
        tenantId: usuario.tenantId,
        nomeEmpresa: usuario.tenant.nome,
        acesso,
      },
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokens.revogar(refreshToken);
  }

  /**
   * Emite os tokens e monta a resposta de sessão.
   *
   * O `acesso` é calculado aqui quando quem chama não tem o dado em mãos —
   * cadastro novo e aceite de convite, por exemplo. Deixar o campo por conta
   * do chamador significaria, mais cedo ou mais tarde, uma sessão nascendo sem
   * prazo de vencimento e um painel sem aviso nenhum.
   */
  async montarSessao(
    usuario: Omit<UsuarioAutenticado, 'acesso'>,
    refreshToken?: string,
    acesso?: SituacaoDeAcesso,
  ): Promise<SessaoResponse> {
    const situacao = acesso ?? calcularAcesso(await this.buscarTenantDoLogin(usuario.tenantId));

    const tokenAtual =
      refreshToken ?? (await this.refreshTokens.emitir(usuario.tenantId, usuario.id));

    return {
      ...this.montarTokens({
        id: usuario.id,
        papel: usuario.papel,
        permissoes: usuario.permissoes,
        tenantId: usuario.tenantId,
      }),
      refreshToken: tokenAtual,
      usuario: { ...usuario, acesso: situacao },
    };
  }

  private async buscarTenantDoLogin(
    tenantId: string,
  ): Promise<DadosDeAcesso & { nome: string; status: StatusTenant }> {
    const tenant = await this.prisma.comTenantExplicito(tenantId, (tx) =>
      tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { nome: true, status: true, trialTerminaEm: true, ultimoPagamentoEm: true },
      }),
    );

    return {
      nome: tenant.nome,
      status: tenant.status,
      trialTerminaEm: tenant.trialTerminaEm?.toISOString() ?? null,
      ultimoPagamentoEm: tenant.ultimoPagamentoEm?.toISOString() ?? null,
    };
  }

  private registrarUltimoLogin(tenantId: string, usuarioId: string): void {
    void this.prisma
      .comTenantExplicito(tenantId, (tx) =>
        tx.usuario.update({
          where: { id: usuarioId },
          data: { ultimoLoginEm: new Date() },
          select: { id: true },
        }),
      )
      .catch((erro: unknown) => {
        const detalhe = erro instanceof Error ? erro.message : String(erro);
        this.logger.warn(
          `Não foi possível registrar último login do usuário ${usuarioId}: ${detalhe}`,
        );
      });
  }

  private montarTokens(
    dados: Pick<UsuarioAutenticado, 'id' | 'papel' | 'permissoes' | 'tenantId'>,
  ): {
    accessToken: string;
    expiraEm: number;
  } {
    const minutos = this.config.get('JWT_ACCESS_TTL_MINUTOS', { infer: true });
    const expiraEm = minutos * 60;

    const payload: JwtPayload = {
      tipo: 'acesso',
      sub: dados.id,
      tenantId: dados.tenantId,
      papel: dados.papel,
      permissoes: dados.permissoes,
    };

    return {
      accessToken: this.jwt.sign(payload, { expiresIn: expiraEm }),
      expiraEm,
    };
  }

  /**
   * Barra a entrada de quem está sem pagamento em dia, e devolve o prazo.
   *
   * A regra é uma só — cada pagamento vale um mês a partir do dia em que foi
   * confirmado, e antes do primeiro pagamento vale o período de teste — e mora
   * em `calcularAcesso`, para a API barrar e a tela avisar exatamente pelo
   * mesmo critério.
   *
   * A verificação fica no login e na renovação da sessão, não espalhada pelas
   * telas: são as duas únicas portas de entrada, e uma rota nova nasce
   * protegida sem ninguém precisar lembrar disso. O preço é a sessão aberta
   * sobreviver até o access token expirar (15 minutos) — aceitável para
   * cobrança, e o tipo de brecha que não vale um `guard` em cada requisição.
   *
   * O status `suspenso` continua valendo como bloqueio manual do suporte,
   * independente da data de pagamento.
   */
  private garantirAcessoEmDia(tenant: DadosDeAcesso & { status: StatusTenant }): SituacaoDeAcesso {
    if (tenant.status === 'suspenso') {
      throw new ForbiddenException({
        codigo: CODIGOS_ERRO.TENANT_SUSPENSO,
        mensagem:
          'Acesso suspenso por pendência no pagamento. Regularize para voltar a usar o sistema.',
      });
    }

    const situacao = calcularAcesso(tenant);

    if (!situacao.liberado) {
      // 402 em vez de 403: o filtro global traduz para `TENANT_SUSPENSO`, e o
      // status diz ao frontend que o caminho é pagar, não pedir permissão.
      throw new HttpException(
        { codigo: CODIGOS_ERRO.TENANT_SUSPENSO, mensagem: mensagemDeAcesso(situacao) },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return situacao;
  }

  private credenciaisInvalidas(): UnauthorizedException {
    return new UnauthorizedException({
      codigo: CODIGOS_ERRO.NAO_AUTENTICADO,
      mensagem: 'E-mail ou senha incorretos.',
    });
  }
}
