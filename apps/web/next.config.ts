import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_BYTES_CORPO_LANCAMENTO } from '@gestao/shared-types';
import type { NextConfig } from 'next';

// `fileURLToPath` em vez de `new URL(...).pathname`: no Windows o pathname vem
// como "/C:/..." e o Next não consegue resolvê-lo.
const raizMonorepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

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
