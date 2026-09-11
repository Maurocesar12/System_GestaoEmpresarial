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
 * Barra quem não tem o papel exigido pela rota.
 *
 * Roda depois do `PermissoesGuard` e é independente dele: uma rota pode exigir
 * papel, permissão, ou os dois. Sem `@Papeis` na rota, o guard sai do caminho.
 */
@Injectable()
export class PapeisGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const necessarios = this.reflector.getAllAndOverride<PapelUsuario[]>(CHAVE_PAPEIS, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!necessarios?.length) return true;

    const usuario = obterContextoTenant();

    if (!usuario || !necessarios.includes(usuario.papel)) {
      throw new ForbiddenException({
        codigo: CODIGOS_ERRO.SEM_PERMISSAO,
        // Dizer de quem é a ação evita o suporte por trás do "sem permissão":
        // quem leu a mensagem já sabe a quem pedir.
        mensagem:
          necessarios.length === 1 && necessarios[0] === 'admin'
            ? 'Esta ação é restrita ao administrador da empresa.'
            : 'Seu perfil não permite esta ação.',
      });
    }

    return true;
  }
}
