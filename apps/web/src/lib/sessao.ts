import 'server-only';
import { cookies } from 'next/headers';
import { PAPEIS_USUARIO, PERMISSOES, type SessaoResponse } from '@gestao/shared-types';
import { z } from 'zod';

/**
 * Guarda a sessão em cookies (arquitetura §9.1).
 *
 * A API devolve os tokens no corpo da resposta e **não** seta cookie: ela vive
 * em outro domínio, e o navegador não aceitaria. Quem grava é o Next, do lado
 * do servidor, com as três proteções que importam:
 *
 * - `httpOnly` — JavaScript da página não consegue ler. Sem isso, qualquer
 *   script injetado (XSS) roubaria a sessão. É a razão de nunca usar
 *   `localStorage` para token.
 * - `secure` — só trafega por HTTPS. Desligado em desenvolvimento, onde o
 *   endereço é `http://localhost` e o cookie simplesmente não seria gravado.
 * - `sameSite: 'lax'` — o navegador não envia o cookie em requisições vindas de
 *   outro site, o que barra CSRF nas ações que importam.
 *
 * `server-only` no topo é uma trava: se algum componente de cliente importar
 * este arquivo por engano, o build falha em vez de vazar token para o navegador.
 */

const COOKIE_ACCESS = 'gestao_access';
const COOKIE_REFRESH = 'gestao_refresh';
const COOKIE_USUARIO = 'gestao_usuario';

const usuarioCookieSchema = z.object({
  id: z.string(),
  nome: z.string(),
  email: z.string(),
  papel: z.enum(PAPEIS_USUARIO),
  permissoes: z.array(z.enum(PERMISSOES)),
  tenantId: z.string(),
  nomeEmpresa: z.string(),
});

export async function gravarSessao(sessao: SessaoResponse): Promise<void> {
  const jar = await cookies();
  const producao = process.env.NODE_ENV === 'production';

  const base = {
    httpOnly: true,
    secure: producao,
    sameSite: 'lax' as const,
    path: '/',
  };

  jar.set(COOKIE_ACCESS, sessao.accessToken, {
    ...base,
    // O cookie expira junto com o token. Assim o middleware de rota consegue
    // detectar a sessão vencida pela simples ausência do cookie.
    maxAge: sessao.expiraEm,
  });

  jar.set(COOKIE_REFRESH, sessao.refreshToken, {
    ...base,
    // Vive mais que o access token — é ele que permite renovar a sessão sem
    // pedir a senha de novo.
    maxAge: 60 * 60 * 24 * 7,
  });

  jar.set(COOKIE_USUARIO, encodeURIComponent(JSON.stringify(sessao.usuario)), {
    ...base,
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function lerAccessToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(COOKIE_ACCESS)?.value;
}

export async function lerRefreshToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(COOKIE_REFRESH)?.value;
}

export async function lerUsuarioDaSessao(): Promise<SessaoResponse['usuario'] | undefined> {
  const jar = await cookies();
  const bruto = jar.get(COOKIE_USUARIO)?.value;

  if (!bruto) {
    return undefined;
  }

  try {
    return usuarioCookieSchema.parse(JSON.parse(decodeURIComponent(bruto)));
  } catch {
    return undefined;
  }
}

export async function limparSessao(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_ACCESS);
  jar.delete(COOKIE_REFRESH);
  jar.delete(COOKIE_USUARIO);
}
