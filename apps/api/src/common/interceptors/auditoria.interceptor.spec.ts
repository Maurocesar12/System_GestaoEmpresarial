import { lastValueFrom, of, type Observable } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { AuditoriaInterceptor } from './auditoria.interceptor';
import { runComTenant, type TenantContext } from '../../infra/tenant/tenant-context';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { AuditoriaService } from '../../modules/plataforma/auditoria/auditoria.service';

const CONTEXTO: TenantContext = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  usuarioId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  papel: 'admin',
  requestId: 'req-teste',
};

describe('AuditoriaInterceptor', () => {
  const registrar = jest.fn();
  const prisma = {
    comTenant: jest.fn((operacao: (tx: unknown) => unknown) => operacao({})),
  } as unknown as PrismaService;

  const interceptor = new AuditoriaInterceptor(prisma, {
    registrar,
  } as unknown as AuditoriaService);

  const execucao = (controlador: string, method = 'DELETE'): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ method, path: '/api/recurso', params: {}, body: {} }),
      }),
      getClass: () => ({ name: controlador }),
    }) as unknown as ExecutionContext;

  const proximo: CallHandler = { handle: (): Observable<unknown> => of({ ok: true }) };

  beforeEach(() => jest.clearAllMocks());

  // O motivo está em CONTROLADORES_SEM_TRILHA: apagar histórico é ação de
  // admin e não deve recolocar na lista o que ele acabou de tirar.
  it('não registra nada quando a rota é do próprio histórico', async () => {
    await runComTenant(CONTEXTO, () =>
      lastValueFrom(interceptor.intercept(execucao('AuditoriaController'), proximo)),
    );

    expect(registrar).not.toHaveBeenCalled();
  });

  it('continua registrando os demais controllers sem trilha transacional', async () => {
    await runComTenant(CONTEXTO, () =>
      lastValueFrom(interceptor.intercept(execucao('ServicosController'), proximo)),
    );

    expect(registrar).toHaveBeenCalledTimes(1);
    expect(registrar.mock.calls[0]?.[1]).toMatchObject({ entidade: 'servicos', acao: 'excluiu' });
  });

  it('não registra quem já grava dentro da própria transação', async () => {
    await runComTenant(CONTEXTO, () =>
      lastValueFrom(interceptor.intercept(execucao('ClientesController'), proximo)),
    );

    expect(registrar).not.toHaveBeenCalled();
  });

  it('ignora leitura', async () => {
    await runComTenant(CONTEXTO, () =>
      lastValueFrom(interceptor.intercept(execucao('ServicosController', 'GET'), proximo)),
    );

    expect(registrar).not.toHaveBeenCalled();
  });
});
