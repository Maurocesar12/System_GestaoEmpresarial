import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CODIGOS_ERRO, type PapelUsuario } from '@gestao/shared-types';
import { CHAVE_PAPEIS } from '../decorators/papeis.decorator';
import { obterContextoTenant } from '../../infra/tenant/tenant-context';

/**
 * Aplica a restrição por papel declarada com `@Papeis(...)` (arquitetura §9.5).
 *
 * O papel vem do JWT, via contexto — nunca de algo que o cliente possa enviar.
 * Um usuário `atendente` não vira `admin` mandando um campo a mais no corpo da
 * requisição.
 */
@Injectable()
export class PapeisGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const papeisPermitidos = this.reflector.getAllAndOverride<PapelUsuario[]>(CHAVE_PAPEIS, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Rota sem `@Papeis(...)` aceita qualquer usuário autenticado do tenant.
    if (!papeisPermitidos || papeisPermitidos.length === 0) {
      return true;
    }

    const contexto = obterContextoTenant();

    // Sem contexto, quem responde é o JwtAuthGuard, que roda antes. Chegar aqui
    // sem contexto significaria rota pública com `@Papeis` — combinação sem
    // sentido, e que negamos em vez de deixar passar.
    if (!contexto) {
      throw new ForbiddenException({
        codigo: CODIGOS_ERRO.SEM_PERMISSAO,
        mensagem: 'Você não tem permissão para esta ação.',
      });
    }

    if (!papeisPermitidos.includes(contexto.papel)) {
      throw new ForbiddenException({
        codigo: CODIGOS_ERRO.SEM_PERMISSAO,
        mensagem: 'Você não tem permissão para esta ação.',
      });
    }

    return true;
  }
}
