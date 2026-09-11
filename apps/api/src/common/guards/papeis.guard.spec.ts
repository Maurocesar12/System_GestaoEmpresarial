import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PapelUsuario } from '@gestao/shared-types';
import { PapeisGuard } from './papeis.guard';
import { runComTenant, type TenantContext } from '../../infra/tenant/tenant-context';

const contexto = (papel: PapelUsuario): TenantContext => ({
  tenantId: '11111111-1111-1111-1111-111111111111',
  usuarioId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  papel,
  // Todas as permissões do produto não abrem uma rota restrita por papel —
  // é justamente isso que os testes abaixo travam.
  permissoes: undefined,
  requestId: 'req-teste',
});

/** O guard só lê metadados da rota; o `ExecutionContext` pode ser mínimo. */
const execucao = {
  getHandler: () => undefined,
  getClass: () => undefined,
} as unknown as ExecutionContext;

function guardExigindo(papeis: PapelUsuario[] | undefined): PapeisGuard {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(papeis);

  return new PapeisGuard(reflector);
}

describe('PapeisGuard', () => {
  afterEach(() => jest.restoreAllMocks());

  it('deixa passar a rota que não exige papel nenhum', () => {
    expect(guardExigindo(undefined).canActivate(execucao)).toBe(true);
  });

  it('deixa o admin executar a rota restrita', () => {
    runComTenant(contexto('admin'), () => {
      expect(guardExigindo(['admin']).canActivate(execucao)).toBe(true);
    });
  });

  it.each<PapelUsuario>(['financeiro', 'atendente', 'tecnico'])(
    'barra o papel %s na rota de admin',
    (papel) => {
      runComTenant(contexto(papel), () => {
        expect(() => guardExigindo(['admin']).canActivate(execucao)).toThrow(ForbiddenException);
      });
    },
  );

  it('barra requisição sem contexto de tenant', () => {
    expect(() => guardExigindo(['admin']).canActivate(execucao)).toThrow(ForbiddenException);
  });
});
