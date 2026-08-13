import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CODIGOS_ERRO } from '@gestao/shared-types';
import { CHAVE_ROTA_PUBLICA } from '../decorators/publico.decorator';
import { obterContextoTenant } from '../../infra/tenant/tenant-context';

/**
 * Exige que a requisição esteja autenticada.
 *
 * Registrado globalmente no `AppModule`, então vale para **todas** as rotas.
 * As exceções são declaradas com `@Publico()`.
 *
 * A verificação é simples porque o trabalho pesado já aconteceu: o
 * `TenantMiddleware` conferiu a assinatura do JWT e, se ela era válida,
 * estabeleceu o contexto. Existir contexto aqui significa que havia um token
 * legítimo — não há como preenchê-lo de outra forma.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const ehPublica = this.reflector.getAllAndOverride<boolean>(CHAVE_ROTA_PUBLICA, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (ehPublica) {
      return true;
    }

    if (!obterContextoTenant()) {
      throw new UnauthorizedException({
        codigo: CODIGOS_ERRO.NAO_AUTENTICADO,
        mensagem: 'Faça login para continuar.',
      });
    }

    return true;
  }
}
