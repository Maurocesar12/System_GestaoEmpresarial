import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '@gestao/shared-types';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { runComTenant } from './tenant-context';

/**
 * Preenche o contexto de tenant a partir do JWT — camada 1 do isolamento
 * (arquitetura §4.2).
 *
 * É a peça que faltava para fechar o ciclo: o token traz o `tenantId`, este
 * middleware o coloca no `AsyncLocalStorage`, e tudo que roda dali para frente
 * — a extensão do Prisma e o `SET app.current_tenant_id` da RLS — lê daquele
 * mesmo lugar.
 *
 * **Por que middleware, e não um guard ou interceptor?** Porque o contexto
 * precisa *envolver* o resto da requisição, e só o middleware permite isso: a
 * chamada a `next()` acontece dentro de `runComTenant`, então todo o
 * processamento seguinte roda dentro do escopo. Um guard apenas decide se a
 * requisição passa; ele não tem como embrulhar o que vem depois.
 *
 * **Este middleware não autoriza nada.** Se o token estiver ausente, expirado
 * ou inválido, ele simplesmente segue sem contexto — quem recusa a requisição é
 * o `JwtAuthGuard`. A separação é proposital: aqui se estabelece contexto, lá
 * se decide acesso. Sem contexto, a RLS não devolve nenhuma linha de tabela
 * isolada, então seguir em frente não abre brecha.
 *
 * ## Custo
 *
 * Barato, e de propósito. Verificar um JWT é um HMAC-SHA256 sobre algumas
 * centenas de bytes — ordem de microssegundos, sem tocar no banco. É o que
 * torna viável autenticar toda requisição sem consultar o usuário: os dados de
 * que precisamos (`tenantId`, `papel`) viajam assinados dentro do próprio token.
 *
 * A verificação acontece **uma única vez** por requisição, aqui. O
 * `JwtAuthGuard` apenas confere se o contexto existe, sem revalidar nada.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  constructor(private readonly jwt: JwtService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const token = this.extrairToken(req);

    if (!token) {
      next();
      return;
    }

    let payload: JwtPayload;
    try {
      // `verify`, e não `decode`: o decode apenas lê o conteúdo, sem conferir a
      // assinatura — qualquer pessoa poderia forjar um token com o `tenantId`
      // de outra empresa e ele seria aceito.
      payload = this.jwt.verify<JwtPayload>(token);
    } catch {
      // Token inválido ou expirado. Segue sem contexto; o guard responde 401.
      next();
      return;
    }

    const requestId = randomUUID();

    // O id da requisição também vai no cabeçalho da resposta: quando um erro
    // aparece no log, dá para ligá-lo à requisição exata que o usuário fez.
    res.setHeader('X-Request-Id', requestId);

    runComTenant(
      {
        tenantId: payload.tenantId,
        usuarioId: payload.sub,
        papel: payload.papel,
        requestId,
      },
      () => {
        next();
      },
    );
  }

  /** Lê o token do cabeçalho `Authorization: Bearer <token>`. */
  private extrairToken(req: Request): string | undefined {
    const cabecalho = req.headers.authorization;

    if (!cabecalho) {
      return undefined;
    }

    const [tipo, valor] = cabecalho.split(' ');

    return tipo === 'Bearer' && valor ? valor : undefined;
  }
}
