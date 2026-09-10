import { createHmac, timingSafeEqual } from 'node:crypto';
import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../../config/env.schema';
import { Notificador } from '../../infra/notificacoes/notificador';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SenhaService } from './senha.service';

@Injectable()
export class RecuperacaoSenhaService {
  private readonly logger = new Logger(RecuperacaoSenhaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly senhas: SenhaService,
    private readonly config: ConfigService<Env, true>,
    private readonly notificador: Notificador,
  ) {}

  async solicitar(email: string): Promise<void> {
    if (this.notificador.modo !== 'smtp') {
      throw new ServiceUnavailableException('Recuperação por e-mail indisponível. Entre em contato com o suporte.');
    }
    const usuario = await this.prisma.semTenant('identificar conta para recuperação de senha', (db) =>
      db.usuario.findUnique({ where: { email }, select: { id: true, tenantId: true, senhaHash: true, ativo: true } }),
    );
    if (!usuario?.ativo) return;
    const token = this.jwt.sign({
      tipo: 'recuperacao', sub: usuario.id, tenantId: usuario.tenantId,
      versao: this.versao(usuario.senhaHash),
    }, { expiresIn: '20m', audience: 'recuperacao-senha' });
    const url = new URL('/recuperar-senha', this.config.get('APP_URL', { infer: true }));
    // O fragmento não vai para logs HTTP nem para o cabeçalho Referer.
    url.hash = new URLSearchParams({ token }).toString();
    try {
      await this.notificador.enviar({
        destinatario: email, assunto: 'Redefina sua senha',
        corpo: `Para definir uma nova senha, acesse:\n${url.toString()}\n\nO link expira em 20 minutos e só pode ser usado uma vez. Se não solicitou a alteração, ignore este e-mail.`,
      });
    } catch {
      this.logger.error('Falha no envio de recuperação de senha. Verifique o serviço SMTP.');
    }
  }

  async redefinir(token: string, senha: string): Promise<void> {
    let payload: { tipo: string; sub: string; tenantId: string; versao: string };
    try {
      payload = this.jwt.verify(token, { audience: 'recuperacao-senha', algorithms: ['HS256'] });
      if (payload.tipo !== 'recuperacao' || typeof payload.sub !== 'string' || typeof payload.tenantId !== 'string' || !/^[a-f0-9]{64}$/.test(payload.versao)) throw new Error();
    } catch { throw this.linkInvalido(); }
    const usuario = await this.prisma.comTenantExplicito(payload.tenantId, (tx) =>
      tx.usuario.findUnique({ where: { id: payload.sub }, select: { senhaHash: true, ativo: true } }),
    );
    if (!usuario?.ativo || !timingSafeEqual(Buffer.from(this.versao(usuario.senhaHash)), Buffer.from(payload.versao))) throw this.linkInvalido();
    const senhaHash = await this.senhas.gerarHash(senha);
    await this.prisma.comTenantExplicito(payload.tenantId, async (tx) => {
      // A comparação atômica impede duas utilizações concorrentes do mesmo link.
      const alterados = await tx.usuario.updateMany({
        where: { id: payload.sub, senhaHash: usuario.senhaHash, ativo: true }, data: { senhaHash },
      });
      if (alterados.count !== 1) throw this.linkInvalido();
      await tx.refreshToken.updateMany({ where: { usuarioId: payload.sub, revogadoEm: null }, data: { revogadoEm: new Date() } });
    });
  }

  private versao(hash: string): string {
    return createHmac('sha256', this.config.get('JWT_SECRET', { infer: true })).update(`recuperacao:${hash}`).digest('hex');
  }

  private linkInvalido(): BadRequestException {
    return new BadRequestException('Link inválido ou expirado. Solicite uma nova recuperação de senha.');
  }
}
