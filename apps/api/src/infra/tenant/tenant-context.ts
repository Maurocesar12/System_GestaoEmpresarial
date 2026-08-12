import { AsyncLocalStorage } from 'node:async_hooks';
import type { PapelUsuario } from '@gestao/shared-types';

/**
 * Contexto de tenant por requisição — camada 1 do isolamento (arquitetura §4.2).
 *
 * O `tenantId` sai do JWT e é depositado aqui no início da requisição. Tudo que
 * roda dentro desse escopo — o filtro do Prisma e o `SET app.current_tenant_id`
 * que alimenta a RLS — lê daqui, em vez de receber o tenant como parâmetro em
 * cada chamada e depender de alguém lembrar de repassá-lo.
 *
 * Vale igual para jobs do BullMQ: o worker precisa restaurar o contexto a partir
 * do payload antes de tocar no banco. Job sem contexto **falha** — nunca roda
 * sem escopo (arquitetura §4.3).
 */
export interface TenantContext {
  tenantId: string;
  usuarioId: string;
  papel: PapelUsuario;
  /** Correlaciona logs de uma mesma requisição ou job. */
  requestId: string;
}

const storage = new AsyncLocalStorage<TenantContext>();

/** Executa `fn` dentro de um contexto de tenant. */
export function runComTenant<T>(contexto: TenantContext, fn: () => T): T {
  return storage.run(contexto, fn);
}

/** Contexto atual, ou `undefined` fora de um escopo de tenant. */
export function obterContextoTenant(): TenantContext | undefined {
  return storage.getStore();
}

/**
 * Contexto atual, falhando alto quando não existe.
 *
 * Esse throw é intencional e não deve ser transformado em fallback silencioso:
 * acesso a dado sem tenant no escopo é exatamente o bug que vaza informação
 * entre empresas — e vaza em silêncio.
 */
export function exigirContextoTenant(): TenantContext {
  const contexto = storage.getStore();

  if (!contexto) {
    throw new Error(
      'Acesso a dado de tenant fora de um contexto válido. ' +
        'Requisições passam pelo TenantMiddleware; jobs precisam restaurar o ' +
        'contexto a partir do payload antes de consultar o banco.',
    );
  }

  return contexto;
}
