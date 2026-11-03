import { ConflictException, type ArgumentsHost } from '@nestjs/common';
import { CODIGOS_ERRO } from '@gestao/shared-types';
import { AllExceptionsFilter } from './all-exceptions.filter';

function executar(exception: unknown) {
  const json = jest.fn<void, [Record<string, string>]>();
  const status = jest.fn<{ json: typeof json }, [number]>(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/teste' }),
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter().catch(exception, host);

  return { status: status.mock.calls[0]?.[0], corpo: json.mock.calls[0]?.[0] ?? {} };
}

const erroPrisma = (code: string) =>
  Object.assign(new Error(`detalhe interno do banco ${code}`), { code });

describe('AllExceptionsFilter — erros do Prisma', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('P2002 (unique) vira 409, não 500', () => {
    const { status, corpo } = executar(erroPrisma('P2002'));

    expect(status).toBe(409);
    expect(corpo).toMatchObject({ codigo: CODIGOS_ERRO.CONFLITO, requestId: expect.any(String) });
  });

  it('P2003 (chave estrangeira) vira 409', () => {
    expect(executar(erroPrisma('P2003')).status).toBe(409);
  });

  it('P2025 (linha inexistente) vira 404', () => {
    const { status, corpo } = executar(erroPrisma('P2025'));

    expect(status).toBe(404);
    expect(corpo.codigo).toBe(CODIGOS_ERRO.NAO_ENCONTRADO);
  });

  it('P2034 (deadlock) e P2028 (timeout de transação) viram 503, para tentar de novo', () => {
    expect(executar(erroPrisma('P2034')).status).toBe(503);
    expect(executar(erroPrisma('P2028')).status).toBe(503);
  });

  it('nunca devolve o texto original do erro do banco', () => {
    for (const code of ['P2002', 'P2003', 'P2025', 'P2034']) {
      expect(JSON.stringify(executar(erroPrisma(code)).corpo)).not.toContain('detalhe interno');
    }
  });

  it('erro desconhecido continua 500 genérico', () => {
    const { status, corpo } = executar(new Error('boom'));

    expect(status).toBe(500);
    expect(corpo.mensagem).toBe('Erro interno. Tente novamente em instantes.');
  });

  it('código do Prisma sem tratamento específico continua 500', () => {
    expect(executar(erroPrisma('P2010')).status).toBe(500);
  });

  it('exceção HTTP já no formato da API passa intacta', () => {
    const { status, corpo } = executar(
      new ConflictException({ codigo: CODIGOS_ERRO.CONFLITO, mensagem: 'Já foi.' }),
    );

    expect(status).toBe(409);
    expect(corpo).toMatchObject({ codigo: CODIGOS_ERRO.CONFLITO, mensagem: 'Já foi.' });
  });
});
