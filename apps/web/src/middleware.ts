import { NextResponse, type NextRequest } from 'next/server';

/**
 * Redireciona quem não tem sessão para a tela de entrada.
 *
 * **Este middleware não valida o token** — ele só confere se o cookie existe
 * (arquitetura §9.1). A validação da assinatura acontece sempre no NestJS, a
 * cada requisição.
 *
 * A divisão é proposital. O middleware do Next roda a cada navegação e serve
 * para uma coisa só: evitar que a pessoa veja uma tela vazia antes de descobrir
 * que precisa entrar. Se alguém forjar o cookie, passa por aqui e é barrado
 * pela API no instante em que a tela pedir qualquer dado — e sem token válido
 * não há contexto de tenant, então a RLS também não devolveria nada.
 *
 * Duplicar a verificação do JWT aqui significaria manter o segredo de
 * assinatura em dois lugares, e sincronizar duas regras de expiração.
 */

const COOKIE_SESSAO = 'gestao_access';

/** Rotas que exigem sessão. */
const ROTAS_PROTEGIDAS = ['/painel'];

/** Rotas que não fazem sentido para quem já entrou. */
const ROTAS_DE_ENTRADA = ['/entrar', '/cadastro'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const temSessao = Boolean(request.cookies.get(COOKIE_SESSAO)?.value);

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

  return NextResponse.next();
}

export const config = {
  /**
   * Ignora arquivos estáticos e imagens: rodar o middleware neles seria
   * trabalho por requisição sem nenhum efeito.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
