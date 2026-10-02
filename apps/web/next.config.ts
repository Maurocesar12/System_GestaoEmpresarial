import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_BYTES_CORPO_LANCAMENTO } from '@gestao/shared-types';
import type { NextConfig } from 'next';

// `fileURLToPath` em vez de `new URL(...).pathname`: no Windows o pathname vem
// como "/C:/..." e o Next não consegue resolvê-lo.
const raizMonorepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Content-Security-Policy: de onde a página pode carregar cada coisa.
 *
 * O navegador nunca fala com a API direto — toda chamada passa pelo servidor
 * do Next (server components e server actions). Por isso `connect-src` fica
 * só na própria origem: um script injetado não consegue mandar dado para fora,
 * nem para a API com o cookie de alguém.
 *
 * `'unsafe-inline'` em `script-src` é o custo do App Router sem nonce: o Next
 * injeta scripts inline de hidratação. Nonce exigiria renderizar toda página
 * por requisição, inclusive o site público. O resto da política continua
 * valendo: nada de script de outra origem, de `<object>`, de `<base>` trocado,
 * de formulário enviado para fora nem de a página ser embutida em iframe.
 */
function politicaDeConteudo(): string {
  const desenvolvimento = process.env.NODE_ENV !== 'production';

  return [
    "default-src 'self'",
    // `unsafe-eval` só em desenvolvimento: o React usa para montar a pilha de
    // erros. Em produção não entra.
    `script-src 'self' 'unsafe-inline'${desenvolvimento ? " 'unsafe-eval'" : ''}`,
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

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  /**
   * Origens autorizadas a carregar os recursos do servidor de desenvolvimento.
   *
   * Sem isto, abrir o sistema pelo IP da máquina na rede local (para testar no
   * celular, por exemplo) faz o Next recusar os arquivos de JavaScript com 403.
   * A página até aparece, mas o React nunca hidrata — e um formulário sem
   * JavaScript cai no envio nativo do HTML, que é GET e coloca os campos na URL.
   *
   * Vale **apenas em desenvolvimento**. Em produção o Next ignora esta opção.
   */
  allowedDevOrigins: ['192.168.1.71'],

  // Falhar o build em erro de tipo é intencional: erro que passa batido no
  // build vira bug em produção.
  typescript: { ignoreBuildErrors: false },

  // Necessário no monorepo: sem isso o Next infere a raiz errada ao rastrear
  // os arquivos do build.
  outputFileTracingRoot: raizMonorepo,

  experimental: {
    serverActions: {
      /**
       * O padrão são 1 MB, e o lançamento leva nota fiscal e boleto embutidos
       * no corpo, em base64. Com o padrão, anexar um PDF de 2 MB falhava no
       * envio — depois do formulário preenchido, que é o pior momento.
       *
       * O número é o mesmo que a API aceita (`MAX_BYTES_CORPO_LANCAMENTO`):
       * se os dois lados divergirem, um deles recusa o que o outro deixou
       * passar, e o erro aparece só na metade do caminho.
       */
      bodySizeLimit: MAX_BYTES_CORPO_LANCAMENTO,
    },
  },

  async headers() {
    const headers = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
      },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'Content-Security-Policy', value: politicaDeConteudo() },
    ];

    if (process.env.NODE_ENV === 'production') {
      headers.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains',
      });
    }

    return [{ source: '/:path*', headers }];
  },
};

export default nextConfig;
