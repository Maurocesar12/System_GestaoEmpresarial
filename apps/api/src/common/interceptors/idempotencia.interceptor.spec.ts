import { from as from_, lastValueFrom, of, throwError } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import { runComTenant, type TenantContext } from '../../infra/tenant/tenant-context';
import { IdempotenciaInterceptor } from './idempotencia.interceptor';

const CONTEXTO: TenantContext = {
  tenantId: '0198f1a0-0000-7000-8000-000000000001',
  usuarioId: '0198f1a0-0000-7000-8000-000000000002',
  papel: 'admin',
  requestId: 'r1',
};
const CHAVE = 'chave-de-teste-0001';

interface Linha {
  id: string;
  status: string;
  impressao: string;
  resposta: unknown;
  criadoEm: Date;
  expiraEm: Date;
}

/** Banco em memória com a mesma unique (usuário + chave) da tabela. */
function montar() {
  let linha: Linha | undefined;

  const tx = {
    chaveIdempotencia: {
      create: jest.fn(({ data }: { data: Linha }) => {
        if (linha) return Promise.reject(Object.assign(new Error('unique'), { code: 'P2002' }));
        linha = { ...data, status: 'em_andamento', resposta: null, criadoEm: new Date() };
        return Promise.resolve(linha);
      }),
      findFirst: jest.fn(() => Promise.resolve(linha ? { ...linha } : null)),
      updateMany: jest.fn(({ where, data }: { where: Partial<Linha>; data: Partial<Linha> }) => {
        const casa =
          linha &&
          (where.id === undefined || where.id === linha.id) &&
          (where.status === undefined || where.status === linha.status) &&
          (where.impressao === undefined || where.impressao === linha.impressao) &&
          (where.criadoEm === undefined || where.criadoEm.getTime() === linha.criadoEm.getTime());
        if (!linha || !casa) return Promise.resolve({ count: 0 });
        Object.assign(linha, data);
        return Promise.resolve({ count: 1 });
      }),
      deleteMany: jest.fn(({ where }: { where: { impressao?: string; status?: string } }) => {
        if (linha && (where.status === undefined || where.status === linha.status)) {
          linha = undefined;
          return Promise.resolve({ count: 1 });
        }
        return Promise.resolve({ count: 0 });
      }),
    },
  };
  const prisma = {
    comTenant: jest.fn((op: (t: typeof tx) => unknown) => op(tx)),
  } as unknown as PrismaService;

  const setHeader = jest.fn();
  const interceptor = new IdempotenciaInterceptor(prisma);

  function requisicao(
    opcoes: { chave?: string | null; corpo?: object; metodo?: string; tipo?: string } = {},
  ) {
    const {
      chave = CHAVE,
      corpo = { valor: '10.00' },
      metodo = 'POST',
      tipo = 'application/json',
    } = opcoes;
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          method: metodo,
          originalUrl: '/api/reservas/1/movimentar',
          body: corpo,
          headers: { 'content-type': tipo },
          header: (nome: string) => (nome === 'idempotency-key' ? (chave ?? undefined) : undefined),
        }),
        getResponse: () => ({ setHeader }),
      }),
    } as unknown as ExecutionContext;
  }

  const executar = (ctx: ExecutionContext, handler: CallHandler, semContexto = false) =>
    !semContexto
      ? runComTenant(CONTEXTO, () => lastValueFrom(interceptor.intercept(ctx, handler)))
      : lastValueFrom(interceptor.intercept(ctx, handler));

  return { interceptor, requisicao, executar, setHeader, estado: () => linha };
}

const handlerQue = (resposta: unknown) => {
  const handle = jest.fn(() => of(resposta));
  return { handler: { handle } as CallHandler, handle };
};

describe('IdempotenciaInterceptor', () => {
  beforeEach(() => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99); // sem limpeza aleatória
  });
  afterEach(() => jest.restoreAllMocks());

  it('sem o cabeçalho, passa direto sem tocar no banco', async () => {
    const { requisicao, executar, estado } = montar();
    const { handler, handle } = handlerQue({ ok: true });

    await expect(executar(requisicao({ chave: null }), handler)).resolves.toEqual({
      ok: true,
    });
    expect(handle).toHaveBeenCalledTimes(1);
    expect(estado()).toBeUndefined();
  });

  it.each([
    ['upload multipart', { tipo: 'multipart/form-data; boundary=x' }],
    ['método que não é POST', { metodo: 'PATCH' }],
  ])('%s passa direto', async (_nome, opcoes) => {
    const { requisicao, executar, estado } = montar();
    const { handler } = handlerQue({ ok: true });

    await executar(requisicao(opcoes), handler);
    expect(estado()).toBeUndefined();
  });

  it('executa uma vez e a repetição recebe a resposta guardada, sem chamar o handler', async () => {
    const { requisicao, executar, setHeader } = montar();
    const primeiro = handlerQue({ id: 'abc', saldo: '10.00' });
    const segundo = handlerQue({ id: 'OUTRO' });

    await expect(executar(requisicao(), primeiro.handler)).resolves.toEqual({
      id: 'abc',
      saldo: '10.00',
    });
    await expect(executar(requisicao(), segundo.handler)).resolves.toEqual({
      id: 'abc',
      saldo: '10.00',
    });

    expect(segundo.handle).not.toHaveBeenCalled();
    expect(setHeader).toHaveBeenCalledWith('Idempotent-Replayed', 'true');
  });

  it('dois pedidos juntos: só um executa, o outro recebe 409', async () => {
    const { requisicao, executar } = montar();
    let liberar!: (v: unknown) => void;
    const lento = {
      handle: jest.fn(() => from_(new Promise((r) => (liberar = r)))),
    } as unknown as CallHandler;
    const rapido = handlerQue({ id: 'x' });

    const primeiro = executar(requisicao(), lento);
    await new Promise((r) => setImmediate(r));

    await expect(executar(requisicao(), rapido.handler)).rejects.toMatchObject({ status: 409 });
    expect(rapido.handle).not.toHaveBeenCalled();

    liberar({ id: 'ok' });
    await expect(primeiro).resolves.toEqual({ id: 'ok' });
  });

  it('mesma chave com corpo diferente: 422, sem executar', async () => {
    const { requisicao, executar } = montar();
    await executar(requisicao(), handlerQue({ id: 'a' }).handler);
    const outro = handlerQue({ id: 'b' });

    await expect(
      executar(requisicao({ corpo: { valor: '999.00' } }), outro.handler),
    ).rejects.toMatchObject({ status: 422 });
    expect(outro.handle).not.toHaveBeenCalled();
  });

  it('pedido que falhou libera a chave: tentar de novo executa', async () => {
    const { requisicao, executar, estado } = montar();
    const falha = { handle: () => throwError(() => new Error('boom')) } as unknown as CallHandler;

    await expect(executar(requisicao(), falha)).rejects.toThrow('boom');
    expect(estado()).toBeUndefined();

    const nova = handlerQue({ id: 'ok' });
    await expect(executar(requisicao(), nova.handler)).resolves.toEqual({ id: 'ok' });
    expect(nova.handle).toHaveBeenCalledTimes(1);
  });

  it('pedido abandonado (processo caiu no meio) é assumido pelo próximo envio', async () => {
    const { requisicao, executar, estado } = montar();
    const lento = { handle: () => from_(new Promise(() => undefined)) } as unknown as CallHandler;
    void executar(requisicao(), lento); // nunca termina
    await new Promise((r) => setImmediate(r));
    estado()!.criadoEm = new Date(Date.now() - 10 * 60 * 1000);

    const nova = handlerQue({ id: 'retomado' });
    await expect(executar(requisicao(), nova.handler)).resolves.toEqual({ id: 'retomado' });
  });

  it('chave vencida é reaproveitada', async () => {
    const { requisicao, executar, estado } = montar();
    await executar(requisicao(), handlerQue({ id: 'velho' }).handler);
    estado()!.expiraEm = new Date(Date.now() - 1_000);

    const nova = handlerQue({ id: 'novo' });
    await expect(executar(requisicao(), nova.handler)).resolves.toEqual({ id: 'novo' });
  });

  it('chave com formato inválido: 400', () => {
    const { requisicao, executar } = montar();

    expect(() => executar(requisicao({ chave: 'curta' }), handlerQue({}).handler)).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });

  it('sem contexto de tenant (rota pública), ignora o cabeçalho', async () => {
    const { requisicao, executar, estado } = montar();
    const { handler } = handlerQue({ ok: true });

    await executar(requisicao(), handler, true);
    expect(estado()).toBeUndefined();
  });
});
