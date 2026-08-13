import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CODIGOS_ERRO } from '@gestao/shared-types';
import { createHash, randomBytes } from 'node:crypto';
import type { Env } from '../../config/env.schema';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { uuidv7 } from '../../common/uuid';

/**
 * Refresh tokens com rotação (arquitetura §9.1).
 *
 * O access token dura poucos minutos. Para o usuário não ter que digitar a
 * senha o tempo todo, existe um segundo token, de vida longa, que serve só para
 * pedir um access token novo.
 *
 * **Rotação**: cada refresh token vale uma única vez. Ao ser usado, é revogado
 * e um novo é emitido no lugar.
 *
 * **Detecção de reuso**: se um token já revogado aparecer de novo, só há duas
 * explicações — ou ele foi roubado, ou o legítimo foi roubado e já usado. Nos
 * dois casos não dá para saber quem é quem, então todas as sessões do usuário
 * são derrubadas. Perder a sessão é incômodo; deixar um invasor dentro da conta
 * é bem pior.
 *
 * ## O formato do token: `<tenantId>.<segredo>`
 *
 * A tabela `refresh_token` está sob RLS, como todas as outras — o que cria o
 * mesmo paradoxo do login: para achar o token é preciso saber a empresa, e a
 * empresa está justamente no registro que não conseguimos ler.
 *
 * A saída é o token dizer a que empresa pertence. O servidor separa o prefixo,
 * estabelece o contexto e faz a busca normalmente, com o isolamento intacto.
 * Nenhuma exceção de RLS é necessária aqui.
 *
 * Expor o `tenantId` no token não enfraquece nada: ele já viaja dentro do JWT,
 * e não é um segredo — é um identificador. Quem trocar o prefixo por outro só
 * consegue que a busca não encontre nada, porque o hash não vai bater dentro
 * daquela outra empresa.
 */
@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Emite um token novo e devolve o valor em texto puro — a única vez em que
   * ele existe fora do cliente. O banco guarda apenas o hash.
   */
  async emitir(tenantId: string, usuarioId: string): Promise<string> {
    const token = this.montarToken(tenantId);

    await this.prisma.comTenantExplicito(tenantId, (tx) =>
      tx.refreshToken.create({
        data: {
          id: uuidv7(),
          tenantId,
          usuarioId,
          tokenHash: this.calcularHash(token),
          expiraEm: this.calcularExpiracao(),
        },
      }),
    );

    return token;
  }

  /**
   * Troca um refresh token por outro, devolvendo a quem ele pertence.
   *
   * Rejeita token desconhecido, expirado ou já usado. No caso do já usado,
   * derruba todas as sessões do dono antes de rejeitar.
   */
  async rotacionar(token: string): Promise<{ tenantId: string; usuarioId: string; token: string }> {
    const tenantId = this.extrairTenantId(token);
    const tokenHash = this.calcularHash(token);

    const registro = await this.prisma.comTenantExplicito(tenantId, (tx) =>
      tx.refreshToken.findUnique({ where: { tokenHash } }),
    );

    if (!registro) {
      throw this.sessaoInvalida('Sessão inválida. Entre novamente.');
    }

    if (registro.revogadoEm) {
      // Token já usado sendo apresentado outra vez: sinal de credencial roubada.
      this.logger.warn(
        `Refresh token reutilizado (usuário ${registro.usuarioId}). Derrubando todas as sessões.`,
      );

      await this.revogarTodasAsSessoes(tenantId, registro.usuarioId);

      throw this.sessaoInvalida('Sessão encerrada por segurança. Entre novamente.');
    }

    if (registro.expiraEm < new Date()) {
      throw this.sessaoInvalida('Sessão expirada. Entre novamente.');
    }

    const novoToken = this.montarToken(tenantId);

    // Revogar o antigo e criar o novo na mesma transação: se o processo cair no
    // meio, o usuário não fica sem nenhum token válido nem com dois válidos.
    await this.prisma.comTenantExplicito(tenantId, async (tx) => {
      await tx.refreshToken.update({
        where: { id: registro.id },
        data: { revogadoEm: new Date() },
      });

      await tx.refreshToken.create({
        data: {
          id: uuidv7(),
          tenantId,
          usuarioId: registro.usuarioId,
          tokenHash: this.calcularHash(novoToken),
          expiraEm: this.calcularExpiracao(),
        },
      });
    });

    return { tenantId, usuarioId: registro.usuarioId, token: novoToken };
  }

  /** Encerra a sessão correspondente a um token. Usado no logout. */
  async revogar(token: string): Promise<void> {
    let tenantId: string;

    try {
      tenantId = this.extrairTenantId(token);
    } catch {
      // Sair com um token malformado não é erro: o resultado desejado — não
      // ter mais sessão — já está valendo.
      return;
    }

    await this.prisma.comTenantExplicito(tenantId, (tx) =>
      tx.refreshToken.updateMany({
        where: { tokenHash: this.calcularHash(token), revogadoEm: null },
        data: { revogadoEm: new Date() },
      }),
    );
  }

  /** Derruba todas as sessões de um usuário. */
  async revogarTodasAsSessoes(tenantId: string, usuarioId: string): Promise<void> {
    await this.prisma.comTenantExplicito(tenantId, (tx) =>
      tx.refreshToken.updateMany({
        where: { usuarioId, revogadoEm: null },
        data: { revogadoEm: new Date() },
      }),
    );
  }

  /** `<tenantId>.<256 bits aleatórios>` — não é adivinhável por força bruta. */
  private montarToken(tenantId: string): string {
    return `${tenantId}.${randomBytes(32).toString('base64url')}`;
  }

  /**
   * Lê a empresa do prefixo do token.
   *
   * Valida o formato de UUID antes de usar. O valor vai para o
   * `set_config` da RLS, e um texto arbitrário ali causaria erro de conversão
   * no banco em vez de uma recusa limpa de sessão.
   */
  private extrairTenantId(token: string): string {
    const [tenantId] = token.split('.');

    const ehUuid =
      typeof tenantId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId);

    if (!ehUuid) {
      throw this.sessaoInvalida('Sessão inválida. Entre novamente.');
    }

    return tenantId;
  }

  /**
   * SHA-256, e não Argon2id como nas senhas.
   *
   * A diferença é a entropia da entrada. Senha de gente é curta e previsível,
   * então o hash precisa ser lento para encarecer o ataque. Este token são 256
   * bits sorteados: não existe dicionário nem força bruta viável contra ele, e
   * um hash lento só adicionaria latência a cada renovação de sessão.
   */
  private calcularHash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private calcularExpiracao(): Date {
    const dias = this.config.get('JWT_REFRESH_TTL_DIAS', { infer: true });
    return new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
  }

  private sessaoInvalida(mensagem: string): UnauthorizedException {
    return new UnauthorizedException({
      codigo: CODIGOS_ERRO.NAO_AUTENTICADO,
      mensagem,
    });
  }
}
