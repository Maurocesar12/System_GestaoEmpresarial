import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CODIGOS_ERRO, permissoesDoUsuario, type Permissao } from '@gestao/shared-types';
import { CHAVE_PERMISSOES } from '../decorators/permissoes.decorator';
import { obterContextoTenant } from '../../infra/tenant/tenant-context';

@Injectable()
export class PermissoesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const necessarias = this.reflector.getAllAndOverride<Permissao[]>(CHAVE_PERMISSOES, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!necessarias?.length) return true;

    const usuario = obterContextoTenant();
    const concedidas = usuario
      ? permissoesDoUsuario(usuario.papel, usuario.permissoes)
      : [];

    if (!usuario || !necessarias.every((item) => concedidas.includes(item))) {
      throw new ForbiddenException({
        codigo: CODIGOS_ERRO.SEM_PERMISSAO,
        mensagem: 'Você não tem permissão para esta ação.',
      });
    }

    return true;
  }
}
