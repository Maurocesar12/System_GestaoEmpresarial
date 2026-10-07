import { NextResponse, type NextRequest } from 'next/server';
import { gerarNonce, politicaDeConteudo } from './lib/politica-conteudo';

/**
 * Guarda de rota e renovação de sessão.
 *
 * Roda antes de qualquer página começar a renderizar e faz três coisas — a
 * terceira é o Content-Security-Policy com nonce (veja `seguir`).
 *
 * **1. Renova a sessão quando o access token expira.** Ele dura 15 minutos de
 * propósito (arquitetura §9.1): se vazar, a janela de uso é curta. Mas ninguém
 * aceitaria fazer login a cada 15 minutos, então quando o cookie curto some e o
 * refresh token ainda vale, este arquivo pede uma sessão nova e grava os
 * cookies na resposta. Para quem está usando o sistema, nada acontece.
 *
 * Este é o lugar certo para isso porque **só aqui dá para gravar cookies antes
 * da renderização**. Um Server Component consegue lê-los, mas não escrevê-los —
 * o Next bloqueia, já que a resposta HTTP pode já ter começado.
 *
 * **2. Redireciona quem não tem sessão.** E aqui o token *não* é validado —
 * apenas se confere que o cookie existe. A validação da assinatura acontece
 * sempre no NestJS, a cada requisição. Duplicá-la aqui significaria manter o
 * segredo em dois lugares e sincronizar duas regras de expiração; e quem forjar
 * o cookie passa por este ponto, mas é barrado pela API no instante em que a
 * tela pedir qualquer dado — sem token válido não há contexto de tenant, então
 * a RLS também não devolveria nada.
 *
 * ## Sobre o nome do arquivo
 *
 * Chamava-se `middleware.ts` até o Next 16, que renomeou a convenção para
 * `proxy.ts` e a função exportada de `middleware` para `proxy`. O comportamento
 * é o mesmo; o nome antigo ainda funciona, mas emite aviso de depreciação e
 * será removido.
 */

const COOKIE_ACCESS = 'gestao_access';
const COOKIE_REFRESH = 'gestao_refresh';
const COOKIE_USUARIO = 'gestao_usuario';

/** Rotas que exigem sessão. */
const ROTAS_PROTEGIDAS = ['/painel'];

/** Rotas que não fazem sentido para quem já entrou. */
const ROTAS_DE_ENTRADA = ['/entrar', '/cadastro'];

interface SessaoRenovada {
  accessToken: string;
  refreshToken: string;
  expiraEm: number;
  usuario?: unknown;
}

export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get(COOKIE_ACCESS)?.value;
  const refreshToken = request.cookies.get(COOKIE_REFRESH)?.value;
  const csp = politicaDeConteudo(gerarNonce());

  // Sessão expirada mas recuperável: tenta renovar antes de qualquer decisão
  // sobre redirecionar.
  if (!accessToken && refreshToken) {
    const sessao = await renovar(refreshToken);

    if (sessao) {
      const resposta = decidirRota(request, true, csp);
      gravarCookies(resposta, sessao, request.nextUrl.protocol === 'https:');
      return resposta;
    }

    // Renovação recusada — expirou, foi revogada no logout, ou o token foi
    // detectado como reutilizado. Limpa o que sobrou e segue sem sessão.
    const resposta = decidirRota(request, false, csp);
    resposta.cookies.delete(COOKIE_REFRESH);
    resposta.cookies.delete(COOKIE_USUARIO);
    return resposta;
  }

  return decidirRota(request, Boolean(accessToken), csp);
}

/**
 * Segue para a página com o CSP do nonce desta requisição.
 *
 * O cabeçalho vai nos dois sentidos: na resposta, para o navegador aplicar; e
 * na requisição repassada ao Next, que lê o nonce dali e o coloca nos próprios
 * scripts ao renderizar.
 */
function seguir(request: NextRequest, csp: string): NextResponse {
  const cabecalhos = new Headers(request.headers);
  cabecalhos.set('Content-Security-Policy', csp);

  const resposta = NextResponse.next({ request: { headers: cabecalhos } });
  resposta.headers.set('Content-Security-Policy', csp);
  return resposta;
}

/** Aplica as regras de acesso, dado se há sessão válida ou não. */
function decidirRota(request: NextRequest, temSessao: boolean, csp: string): NextResponse {
  const { pathname } = request.nextUrl;

  if (ROTAS_PROTEGIDAS.some((rota) => pathname.startsWith(rota)) && !temSessao) {
    const url = request.nextUrl.clone();
    url.pathname = '/entrar';
    // Guarda para onde a pessoa queria ir, e devolve para lá depois do login.
    url.searchParams.set('destino', pathname);
    return NextResponse.redirect(url);
  }

  if (ROTAS_DE_ENTRADA.some((rota) => pathname.startsWith(rota)) && temSessao) {
    const url = request.nextUrl.clone();
    url.pathname = '/painel';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return seguir(request, csp);
}

/**
 * Pede uma sessão nova à API.
 *
 * Usa `fetch` direto, sem o cliente HTTP do projeto: este código roda no Edge
 * Runtime, que é mais restrito que Node, e manter a chamada mínima evita
 * arrastar dependências que não funcionariam lá.
 */
async function renovar(refreshToken: string): Promise<SessaoRenovada | null> {
  try {
    const resposta = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });

    if (!resposta.ok) {
      return null;
    }

    return (await resposta.json()) as SessaoRenovada;
  } catch {
    // API fora do ar: trata como sessão não renovada. A tela de entrada explica
    // melhor a situação do que uma página de erro.
    return null;
  }
}

function gravarCookies(resposta: NextResponse, sessao: SessaoRenovada, seguro: boolean): void {
  const base = { httpOnly: true, secure: seguro, sameSite: 'lax' as const, path: '/' };

  resposta.cookies.set(COOKIE_ACCESS, sessao.accessToken, {
    ...base,
    maxAge: sessao.expiraEm,
  });

  resposta.cookies.set(COOKIE_REFRESH, sessao.refreshToken, {
    ...base,
    maxAge: 60 * 60 * 24 * 7,
  });

  if (sessao.usuario) {
    resposta.cookies.set(COOKIE_USUARIO, encodeURIComponent(JSON.stringify(sessao.usuario)), {
      ...base,
      maxAge: 60 * 60 * 24 * 7,
    });
  }
}

export const config = {
  /**
   * Ignora arquivos estáticos e imagens: rodar isto neles seria trabalho por
   * requisição sem nenhum efeito.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
