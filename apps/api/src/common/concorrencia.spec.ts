import { ConflictException } from '@nestjs/common';
import {
  VERSAO_SUBIU,
  exigirLinhaAfetada,
  filtroDeVersao,
  gravarSeNaoMudou,
  nenhumaLinhaCasou,
} from './concorrencia';

const erroPrisma = (code: string) => Object.assign(new Error(`Prisma ${code}`), { code });

describe('nenhumaLinhaCasou', () => {
  it('reconhece o P2025 do Prisma', () => {
    expect(nenhumaLinhaCasou(erroPrisma('P2025'))).toBe(true);
  });

  it('não confunde com outros erros do Prisma', () => {
    // P2002 (unique) e P2003 (chave estrangeira) têm outro tratamento.
    expect(nenhumaLinhaCasou(erroPrisma('P2002'))).toBe(false);
    expect(nenhumaLinhaCasou(erroPrisma('P2003'))).toBe(false);
  });

  it('não confunde com erro comum nem com valores que não são objeto', () => {
    expect(nenhumaLinhaCasou(new Error('falhou'))).toBe(false);
    expect(nenhumaLinhaCasou(null)).toBe(false);
    expect(nenhumaLinhaCasou(undefined)).toBe(false);
    expect(nenhumaLinhaCasou('P2025')).toBe(false);
  });
});

describe('gravarSeNaoMudou', () => {
  it('devolve a linha gravada quando o where casou', async () => {
    await expect(gravarSeNaoMudou(Promise.resolve({ id: 'a' }))).resolves.toEqual({ id: 'a' });
  });

  it('converte "nenhuma linha casou" em 409 com a mensagem de quem chamou', async () => {
    const resultado = gravarSeNaoMudou(Promise.reject(erroPrisma('P2025')), 'Mudou no meio.');

    await expect(resultado).rejects.toBeInstanceOf(ConflictException);
    await expect(resultado).rejects.toMatchObject({
      response: { mensagem: 'Mudou no meio.' },
    });
  });

  it('tem mensagem padrão quando quem chama não informa uma', async () => {
    await expect(gravarSeNaoMudou(Promise.reject(erroPrisma('P2025')))).rejects.toMatchObject({
      response: { mensagem: expect.stringContaining('alterado por outra pessoa') },
    });
  });

  it('deixa passar qualquer outro erro, sem disfarçá-lo de conflito', async () => {
    const original = erroPrisma('P2002');

    await expect(gravarSeNaoMudou(Promise.reject(original))).rejects.toBe(original);
  });
});

describe('controle otimista por versão', () => {
  it('sem versão da tela, o where não exige nada (cliente antigo segue funcionando)', () => {
    expect(filtroDeVersao(undefined)).toEqual({});
  });

  it('com versão, ela entra no where', () => {
    expect(filtroDeVersao(4)).toEqual({ versao: 4 });
  });

  it('a versão zero também conta: só `undefined` é "não mandou"', () => {
    expect(filtroDeVersao(0)).toEqual({ versao: 0 });
  });

  it('a gravação sobe a versão no mesmo UPDATE', () => {
    expect(VERSAO_SUBIU).toEqual({ versao: { increment: 1 } });
  });
});

describe('exigirLinhaAfetada', () => {
  it('aceita quando ao menos uma linha foi afetada', () => {
    expect(() => exigirLinhaAfetada({ count: 1 })).not.toThrow();
  });

  it('count 0 é a corrida perdida: 409', () => {
    expect(() => exigirLinhaAfetada({ count: 0 }, 'Já foi.')).toThrow(ConflictException);
  });
});
