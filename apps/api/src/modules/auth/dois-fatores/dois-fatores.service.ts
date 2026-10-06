import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CODIGOS_ERRO,
  type ConfiguracaoDoisFatores,
  type SessaoResponse,
} from '@gestao/shared-types';
import { toDataURL } from 'qrcode';
import type { Env } from '../../../config/env.schema';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { AuthService } from '../auth.service';
import { CifraSegredo, conferirCodigo, gerarSegredo, urlOtpauth } from './totp';

/** Nome que aparece no app autenticador, acima do e-mail. */
const EMISSOR = 'Gestão Empresarial';
/** Erros seguidos antes do bloqueio. */
const LIMITE_FALHAS = 5;
const BLOQUEIO_MS = 15 * 60 * 1000;

/**
 * Segunda etapa de todo login: o código do app autenticador.
 *
 * Não há códigos de recuperação: quem perde o celular pede ao administrador da
 * empresa para redefinir o 2FA (Equipe → Editar acesso), e o único admin usa
 * o comando `2fa:redefinir`.
 *
 * O rate limit por IP do controller não basta sozinho: quem distribui as
 * tentativas por vários IPs passaria. Por isso os erros também contam por
 * conta, no banco, e cinco seguidos bloqueiam o 2FA daquela pessoa por 15
 * minutos — com 3 códigos válidos em 1 milhão por tentativa, adivinhar fica
 * fora de alcance.
 */
@Injectable()
export class DoisFatoresService {
  private readonly cifra: CifraSegredo;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    config: ConfigService<Env, true>,
  ) {
    this.cifra = new CifraSegredo(config.get('JWT_SECRET', { infer: true }));
  }

  /** Gera o segredo e o QR code para quem ainda não configurou o app. */
  async prepararConfiguracao(desafio: string): Promise<ConfiguracaoDoisFatores> {
    const token = this.auth.lerDesafio(desafio);
    const usuario = await this.buscar(token.sub, token.tenantId);
    this.garantirNaoConfigurado(usuario.doisFatoresAtivadoEm);

    const segredo = gerarSegredo();
    // O segredo ainda não vai para o banco: viaja cifrado dentro do desafio até
    // a pessoa provar, com o primeiro código, que o app leu certo. Quem fecha a
    // tela no meio não deixa um segredo órfão gravado.
    const novo = this.auth.emitirDesafio(usuario, false, this.cifra.cifrar(segredo));

    return {
      desafio: novo.desafio,
      segredo: segredo.match(/.{1,4}/g)!.join(' '),
      qrCode: await toDataURL(urlOtpauth(segredo, usuario.email, EMISSOR), {
        margin: 1,
        width: 220,
        errorCorrectionLevel: 'M',
      }),
    };
  }

  /** Confirma o primeiro código, grava o segredo e abre a sessão. */
  async ativar(desafio: string, codigo: string): Promise<SessaoResponse> {
    const token = this.auth.lerDesafio(desafio);
    if (!token.segredo) throw this.desafioInvalido();

    const segredo = this.decifrar(token.segredo);
    const passo = conferirCodigo(segredo, codigo.replace(/\s/g, ''));
    if (passo === null) {
      throw this.codigoInvalido(
        'Código incorreto. Confira se escaneou o QR code desta tela e digite o código que aparece agora no app.',
      );
    }

    const gravados = await this.prisma.comTenantExplicito(token.tenantId, (tx) =>
      tx.usuario.updateMany({
        // `ativadoEm: null` no filtro: duas abas ativando ao mesmo tempo não
        // podem gravar segredos diferentes, uma por cima da outra.
        where: { id: token.sub, doisFatoresAtivadoEm: null },
        data: {
          doisFatoresSegredo: this.cifra.cifrar(segredo),
          doisFatoresAtivadoEm: new Date(),
          doisFatoresUltimoPasso: passo,
          doisFatoresFalhas: 0,
          doisFatoresBloqueadoAte: null,
        },
      }),
    );

    if (gravados.count === 0) this.garantirNaoConfigurado(new Date());

    return this.auth.abrirSessao(token.sub, token.tenantId);
  }

  /** Login de quem já tem o app: o código de 6 dígitos. */
  async verificar(desafio: string, codigo: string): Promise<SessaoResponse> {
    const token = this.auth.lerDesafio(desafio);
    const usuario = await this.buscar(token.sub, token.tenantId);

    if (!usuario.doisFatoresAtivadoEm || !usuario.doisFatoresSegredo) {
      throw new ConflictException({
        codigo: CODIGOS_ERRO.CONFLITO,
        mensagem: 'Configure o app autenticador para continuar.',
      });
    }

    if (usuario.doisFatoresBloqueadoAte && usuario.doisFatoresBloqueadoAte > new Date()) {
      throw this.bloqueado();
    }

    const passo = conferirCodigo(
      this.decifrar(usuario.doisFatoresSegredo),
      codigo.replace(/\s/g, ''),
    );
    if (passo === null) {
      return this.registrarFalha(usuario.id, usuario.doisFatoresFalhas, token.tenantId);
    }

    // Grava o passo só se for posterior ao último aceito — no mesmo `UPDATE`,
    // para que duas requisições com o mesmo código não passem juntas.
    const { count } = await this.prisma.comTenantExplicito(token.tenantId, (tx) =>
      tx.usuario.updateMany({
        where: {
          id: usuario.id,
          OR: [{ doisFatoresUltimoPasso: null }, { doisFatoresUltimoPasso: { lt: passo } }],
        },
        data: {
          doisFatoresUltimoPasso: passo,
          doisFatoresFalhas: 0,
          doisFatoresBloqueadoAte: null,
        },
      }),
    );

    if (count === 0) {
      throw this.codigoInvalido('Este código já foi usado. Espere o próximo aparecer no app.');
    }

    return this.auth.abrirSessao(token.sub, token.tenantId);
  }

  private async registrarFalha(
    usuarioId: string,
    falhasAntes: number,
    tenantId: string,
  ): Promise<never> {
    const falhas = falhasAntes + 1;
    const bloquear = falhas >= LIMITE_FALHAS;

    await this.prisma.comTenantExplicito(tenantId, (tx) =>
      tx.usuario.update({
        where: { id: usuarioId },
        data: bloquear
          ? { doisFatoresFalhas: 0, doisFatoresBloqueadoAte: new Date(Date.now() + BLOQUEIO_MS) }
          : { doisFatoresFalhas: falhas },
        select: { id: true },
      }),
    );

    if (bloquear) throw this.bloqueado();

    const restantes = LIMITE_FALHAS - falhas;
    throw this.codigoInvalido(
      `Código incorreto. ${restantes === 1 ? 'Resta 1 tentativa' : `Restam ${restantes} tentativas`} antes de um bloqueio de 15 minutos.`,
    );
  }

  private async buscar(usuarioId: string, tenantId: string): Promise<UsuarioDoisFatores> {
    const usuario = await this.prisma.comTenantExplicito(tenantId, (tx) =>
      tx.usuario.findUnique({
        where: { id: usuarioId },
        select: {
          id: true,
          tenantId: true,
          email: true,
          ativo: true,
          doisFatoresSegredo: true,
          doisFatoresAtivadoEm: true,
          doisFatoresFalhas: true,
          doisFatoresBloqueadoAte: true,
        },
      }),
    );

    if (!usuario || !usuario.ativo) throw this.desafioInvalido();
    return usuario;
  }

  private decifrar(cifrado: string): string {
    try {
      return this.cifra.decifrar(cifrado);
    } catch {
      // Só acontece se o `JWT_SECRET` mudou depois da configuração: a chave
      // derivada não abre mais o segredo. O caminho é o admin redefinir o 2FA.
      throw new ConflictException({
        codigo: CODIGOS_ERRO.CONFLITO,
        mensagem:
          'Não foi possível validar seu app autenticador. Peça ao administrador para redefinir a verificação em duas etapas.',
      });
    }
  }

  private garantirNaoConfigurado(ativadoEm: Date | null): void {
    if (ativadoEm) {
      throw new ConflictException({
        codigo: CODIGOS_ERRO.CONFLITO,
        mensagem: 'A verificação em duas etapas já está configurada. Entre com o código do app.',
      });
    }
  }

  private codigoInvalido(mensagem: string): UnauthorizedException {
    return new UnauthorizedException({ codigo: CODIGOS_ERRO.NAO_AUTENTICADO, mensagem });
  }

  private desafioInvalido(): UnauthorizedException {
    return this.codigoInvalido('A verificação expirou. Entre com e-mail e senha de novo.');
  }

  private bloqueado(): HttpException {
    return new HttpException(
      {
        codigo: CODIGOS_ERRO.MUITAS_REQUISICOES,
        mensagem: 'Muitos códigos incorretos. Por segurança, tente de novo em 15 minutos.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

interface UsuarioDoisFatores {
  id: string;
  tenantId: string;
  email: string;
  ativo: boolean;
  doisFatoresSegredo: string | null;
  doisFatoresAtivadoEm: Date | null;
  doisFatoresFalhas: number;
  doisFatoresBloqueadoAte: Date | null;
}
