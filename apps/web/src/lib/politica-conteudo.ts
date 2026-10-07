/**
 * Content-Security-Policy: de onde a página pode carregar cada coisa.
 *
 * Montada a cada requisição pelo `proxy.ts`, com um **nonce** novo — um valor
 * aleatório que só o servidor conhece naquele instante. O navegador executa
 * apenas os scripts que trazem esse valor, e o Next o coloca sozinho nos
 * scripts dele. Um script injetado por qualquer caminho (campo mal escapado,
 * extensão, conteúdo de terceiro) não tem como saber o nonce, e não roda.
 *
 * Antes era `'unsafe-inline'`, que libera qualquer script escrito na página.
 *
 * `'strict-dynamic'` deixa os scripts autorizados carregarem os pedaços do
 * próprio Next sob demanda, sem precisar listar cada arquivo.
 *
 * O navegador nunca fala com a API direto — toda chamada passa pelo servidor
 * do Next. Por isso `connect-src` fica só na própria origem: um script
 * injetado não consegue mandar dado para fora.
 */
export function politicaDeConteudo(nonce: string): string {
  const desenvolvimento = process.env.NODE_ENV !== 'production';

  return [
    "default-src 'self'",
    // `unsafe-eval` só em desenvolvimento: o React usa para montar a pilha de
    // erros. Em produção não entra.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${desenvolvimento ? " 'unsafe-eval'" : ''}`,
    // Estilo continua com `unsafe-inline`: o React escreve `style="..."` nos
    // elementos, e CSS não executa código.
    "style-src 'self' 'unsafe-inline'",
    // `data:` e `blob:` para a prévia dos anexos (imagem e PDF) e dos gráficos.
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // O recarregamento ao vivo do `next dev` usa WebSocket.
    `connect-src 'self'${desenvolvimento ? ' ws: wss:' : ''}`,
    "frame-src 'self' blob: data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/** 128 bits aleatórios em base64 — novo a cada requisição. */
export function gerarNonce(): string {
  return btoa(crypto.randomUUID());
}
