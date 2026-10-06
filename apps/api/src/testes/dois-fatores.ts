import type {
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
 * código, como o celular faria) e calcula o código nos logins seguintes.
 *
 * O mesmo código de 30 s não vale duas vezes. Se o atual já foi usado, o
 * helper tenta o do passo seguinte, que o servidor aceita como tolerância de
 * relógio. Isso cobre dois logins da mesma pessoa a cada 30 s; uma suíte que
 * faça mais que isso zera `doisFatoresUltimoPasso` entre os testes.
 *
 * O estado é por arquivo de teste: o Jest isola os módulos de cada arquivo.
 */
const segredoPorUsuario = new Map<string, string>();

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
    const ativacao = await request(servidor)
      .post('/api/auth/2fa/ativar')
      .send({ desafio: configuracao.desafio, codigo: codigoDoPasso(segredo, passoAtual()) })
      .expect(200);

    segredoPorUsuario.set(usuarioId, segredo);
    return ativacao.body as SessaoResponse;
  }

  const segredo = segredoPorUsuario.get(usuarioId);
  if (!segredo) {
    throw new Error('Usuário sem segredo de 2FA no teste: ele foi configurado fora do helper.');
  }

  for (const desvio of [0, 1]) {
    const verificacao = await request(servidor)
      .post('/api/auth/2fa/verificar')
      .send({ desafio: resposta.desafio, codigo: codigoDoPasso(segredo, passoAtual() + desvio) });

    if (verificacao.status === 200) return verificacao.body as SessaoResponse;

    const mensagem = String((verificacao.body as { mensagem?: string }).mensagem ?? '');
    if (!mensagem.includes('já foi usado')) {
      throw new Error(`2FA recusado no teste (${verificacao.status}): ${mensagem}`);
    }
  }

  throw new Error(
    'Os códigos deste intervalo de 30 s já foram usados. Zere doisFatoresUltimoPasso entre os testes.',
  );
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
