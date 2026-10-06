import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.schema';
import type { AuthService } from '../auth.service';
import type { PrismaService } from '../../../infra/prisma/prisma.service';
import { DoisFatoresService } from './dois-fatores.service';
import { CifraSegredo, codigoDoPasso, gerarSegredo, passoAtual } from './totp';

const SEGREDO_MESTRE = 'segredo-mestre-de-teste-com-mais-de-32-caracteres';
const SESSAO = { accessToken: 'acesso', refreshToken: 'refresh', expiraEm: 900 };

/**
 * Regras do segundo fator com o banco simulado em memória.
 *
 * O `updateMany` do simulador aplica os mesmos filtros que o serviço usa
 * (`ultimoPasso < passo` e `ativadoEm: null`), porque é neles que mora a
 * proteção contra reuso de código e contra ativação dupla.
 */
function montar(estado: Record<string, unknown>) {
  const usuario = {
    id: 'u1',
    tenantId: 't1',
    email: 'maria@empresa.com',
    ativo: true,
    doisFatoresSegredo: null as string | null,
    doisFatoresAtivadoEm: null as Date | null,
    doisFatoresUltimoPasso: null as number | null,
    doisFatoresFalhas: 0,
    doisFatoresBloqueadoAte: null as Date | null,
    ...estado,
  };

  const confere = (where: FiltroUsuario): boolean => {
    if (where.doisFatoresAtivadoEm === null && usuario.doisFatoresAtivadoEm !== null) return false;
    const limite = where.OR?.[1]?.doisFatoresUltimoPasso?.lt;
    if (
      limite !== undefined &&
      usuario.doisFatoresUltimoPasso !== null &&
      usuario.doisFatoresUltimoPasso >= limite
    )
      return false;
    return true;
  };

  const tx = {
    usuario: {
      findUnique: jest.fn(() => Promise.resolve({ ...usuario })),
      update: jest.fn(({ data }: { data: object }) =>
        Promise.resolve(Object.assign(usuario, data)),
      ),
      updateMany: jest.fn(({ where, data }: { where: FiltroUsuario; data: object }) => {
        if (!confere(where)) return Promise.resolve({ count: 0 });
        Object.assign(usuario, data);
        return Promise.resolve({ count: 1 });
      }),
    },
  };

  const prisma = {
    comTenantExplicito: jest.fn((_tenantId: string, operacao: (t: typeof tx) => unknown) =>
      operacao(tx),
    ),
  } as unknown as PrismaService;

  let segredoNoDesafio: string | undefined;
  const abrirSessao = jest.fn(() => Promise.resolve(SESSAO));
  const auth = {
    lerDesafio: jest.fn(() => ({
      tipo: 'desafio-2fa',
      sub: 'u1',
      tenantId: 't1',
      segredo: segredoNoDesafio,
    })),
    emitirDesafio: jest.fn((_u: unknown, _c: boolean, segredo?: string) => {
      segredoNoDesafio = segredo;
      return { etapa: 'dois_fatores', desafio: 'novo', configurar: true };
    }),
    abrirSessao,
  } as unknown as AuthService;

  const config = { get: () => SEGREDO_MESTRE } as unknown as ConfigService<Env, true>;
  const servico = new DoisFatoresService(prisma, auth, config);

  return { servico, usuario, abrirSessao };
}

/** O recorte do `where` do Prisma que o serviço usa nos `updateMany`. */
interface FiltroUsuario {
  doisFatoresAtivadoEm?: null;
  OR?: Array<{ doisFatoresUltimoPasso?: { lt?: number } | null }>;
}

describe('DoisFatoresService', () => {
  const cifra = new CifraSegredo(SEGREDO_MESTRE);

  function configurado(extra: Record<string, unknown> = {}) {
    const segredo = gerarSegredo();
    return {
      segredo,
      ...montar({
        doisFatoresSegredo: cifra.cifrar(segredo),
        doisFatoresAtivadoEm: new Date(),
        ...extra,
      }),
    };
  }

  describe('configuração', () => {
    it('gera QR code e só grava o segredo depois do primeiro código certo', async () => {
      const { servico, usuario } = montar({});

      const configuracao = await servico.prepararConfiguracao('desafio');
      expect(configuracao.qrCode).toMatch(/^data:image\/png;base64,/);
      expect(usuario.doisFatoresSegredo).toBeNull();

      const segredo = configuracao.segredo.replace(/\s/g, '');
      await expect(servico.ativar('desafio', codigoDoPasso(segredo, passoAtual()))).resolves.toBe(
        SESSAO,
      );

      expect(usuario.doisFatoresAtivadoEm).toBeInstanceOf(Date);
      // Gravado cifrado, nunca o segredo em texto.
      expect(usuario.doisFatoresSegredo).not.toContain(segredo);
    });

    it('recusa ativar com código errado, sem abrir sessão', async () => {
      const { servico, abrirSessao } = montar({});
      await servico.prepararConfiguracao('desafio');

      await expect(servico.ativar('desafio', '000000')).rejects.toMatchObject({ status: 401 });
      expect(abrirSessao).not.toHaveBeenCalled();
    });

    it('não deixa reconfigurar quem já ativou', async () => {
      const { servico } = configurado();

      await expect(servico.prepararConfiguracao('desafio')).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('verificação', () => {
    it('abre a sessão com o código do app', async () => {
      const { servico, segredo, usuario } = configurado();

      await expect(
        servico.verificar('desafio', codigoDoPasso(segredo, passoAtual())),
      ).resolves.toBe(SESSAO);
      expect(usuario.doisFatoresUltimoPasso).toBe(passoAtual());
    });

    it('não aceita o mesmo código duas vezes', async () => {
      const { servico, segredo, abrirSessao } = configurado();
      const codigo = codigoDoPasso(segredo, passoAtual());

      await servico.verificar('desafio', codigo);
      await expect(servico.verificar('desafio', codigo)).rejects.toMatchObject({ status: 401 });
      expect(abrirSessao).toHaveBeenCalledTimes(1);
    });

    it('bloqueia na quinta falha, e o bloqueio vale até para o código certo', async () => {
      const { servico, segredo, usuario, abrirSessao } = configurado();

      for (let tentativa = 1; tentativa <= 4; tentativa++) {
        await expect(servico.verificar('desafio', '000000')).rejects.toMatchObject({ status: 401 });
      }
      expect(usuario.doisFatoresFalhas).toBe(4);

      await expect(servico.verificar('desafio', '000000')).rejects.toMatchObject({ status: 429 });
      expect(usuario.doisFatoresBloqueadoAte!.getTime()).toBeGreaterThan(Date.now());

      await expect(
        servico.verificar('desafio', codigoDoPasso(segredo, passoAtual())),
      ).rejects.toMatchObject({ status: 429 });
      expect(abrirSessao).not.toHaveBeenCalled();
    });

    it('acerto zera as falhas', async () => {
      const { servico, segredo, usuario } = configurado({ doisFatoresFalhas: 3 });

      await servico.verificar('desafio', codigoDoPasso(segredo, passoAtual()));
      expect(usuario.doisFatoresFalhas).toBe(0);
    });

    it('pede configuração a quem ainda não tem o app', async () => {
      const { servico } = montar({});

      await expect(servico.verificar('desafio', '123456')).rejects.toMatchObject({ status: 409 });
    });
  });
});
