import type {
  AtivacaoDoisFatores,
  ConfiguracaoDoisFatores,
  DesafioDoisFatores,
  SessaoResponse,
} from '@gestao/shared-types';

import request from 'supertest';
import { codigoDoPasso, passoAtual } from '../modules/auth/dois-fatores/totp';

type Servidor = Parameters<typeof request>[0];

/**
 * Faz nos testes de integração o que a tela faz: leva o desafio do 2FA até a sessão.
 *
 * Login, cadastro e aceite de convite não devolvem mais sessão. Este helper
 * configura o app na primeira vez (lendo o segredo da resposta e calculando o
 * código, como o celular faria) e, nos logins seguintes, usa os códigos de
 * recuperação. Recuperação, e não TOTP, porque o mesmo código de 30 s não pode
 * ser usado duas vezes — e a suíte faz vários logins seguidos da mesma pessoa.
 *
 * O estado é por arquivo de teste: o Jest isola os módulos de cada arquivo.
 */
const recuperacaoPorUsuario = new Map<string, string[]>();

function usuarioDoDesafio(desafio: string): string {
  const payload = JSON.parse(Buffer.from(desafio.split('.')[1]!, 'base64url').toString()) as {
    sub: string;
  };
  return payload.sub;
}

export async function concluirDoisFatores(
  servidor: Servidor,
  resposta: DesafioDoisFatores,
): Promise<SessaoResponse> {
  const usuarioId = usuarioDoDesafio(resposta.desafio);

  if (resposta.configurar) {
    const configuracao = (
      await request(servidor)
        .post('/api/auth/2fa/configuracao')
        .send({ desafio: resposta.desafio })
        .expect(200)
    ).body as ConfiguracaoDoisFatores;

    const segredo = configuracao.segredo.replace(/\s/g, '');
    const ativacao = (
      await request(servidor)
        .post('/api/auth/2fa/ativar')
        .send({ desafio: configuracao.desafio, codigo: codigoDoPasso(segredo, passoAtual()) })
        .expect(200)
    ).body as AtivacaoDoisFatores;

    recuperacaoPorUsuario.set(usuarioId, [...ativacao.codigosRecuperacao]);
    return ativacao.sessao;
  }

  const codigo = recuperacaoPorUsuario.get(usuarioId)?.shift();
  if (!codigo) {
    throw new Error(
      'Sem código de recuperação para este usuário no teste — ele foi criado fora do helper ou já usou os 10.',
    );
  }

  const verificacao = await request(servidor)
    .post('/api/auth/2fa/verificar')
    .send({ desafio: resposta.desafio, codigo })
    .expect(200);
  return verificacao.body as SessaoResponse;
}

/** Login completo, senha e segundo fator. */
export async function entrarComDoisFatores(
  servidor: Servidor,
  email: string,
  senha: string,
): Promise<SessaoResponse> {
  const login = await request(servidor).post('/api/auth/login').send({ email, senha }).expect(200);
  return concluirDoisFatores(servidor, login.body as DesafioDoisFatores);
}
