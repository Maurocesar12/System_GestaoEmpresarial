import { LembretesEnvioModule } from './lembretes-envio.module';
import { LembretesAgendador } from './lembretes.agendador';
import { LembretesProcessor } from './lembretes.processor';

/**
 * `registrar()` só monta a descrição do módulo — nada aqui abre conexão com
 * Redis, o que só aconteceria se o Nest instanciasse o módulo de verdade.
 */
describe('LembretesEnvioModule.registrar', () => {
  const redisOriginal = process.env.REDIS_URL;

  afterEach(() => {
    if (redisOriginal === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = redisOriginal;
    }
  });

  it('entra vazio quando não há Redis configurado', () => {
    // É o que permite `pnpm dev` funcionar sem infraestrutura extra: a API sobe,
    // o CRUD de lembretes continua de pé e os lembretes ficam pendentes.
    delete process.env.REDIS_URL;

    const modulo = LembretesEnvioModule.registrar();

    expect(modulo.imports ?? []).toHaveLength(0);
    expect(modulo.providers ?? []).toHaveLength(0);
  });

  it('registra o agendador e o worker quando há Redis', () => {
    process.env.REDIS_URL = 'redis://localhost:6379';

    const modulo = LembretesEnvioModule.registrar();

    expect(modulo.providers).toEqual([LembretesAgendador, LembretesProcessor]);
    expect(modulo.imports?.length).toBeGreaterThan(0);
  });
});
