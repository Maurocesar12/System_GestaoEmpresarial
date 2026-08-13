import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { exigirContextoTenant, type TenantContext } from '../../infra/tenant/tenant-context';

/**
 * Entrega ao controller quem está fazendo a requisição.
 *
 * Lê do contexto de tenant, e não do corpo ou da query — o que impede o caso
 * clássico de alguém mandar `?usuarioId=outro` e ser atendido. A origem é
 * sempre o JWT assinado.
 *
 * @example
 * ```ts
 * @Get('meu-perfil')
 * perfil(@UsuarioAtual() usuario: TenantContext) {
 *   return this.usuarios.buscar(usuario.usuarioId);
 * }
 * ```
 */
export const UsuarioAtual = createParamDecorator(
  (_dados: unknown, _ctx: ExecutionContext): TenantContext => exigirContextoTenant(),
);
