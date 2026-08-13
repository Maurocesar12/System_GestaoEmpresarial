import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

// `fileURLToPath` em vez de `new URL(...).pathname`: no Windows o pathname vem
// como "/C:/..." e o Next não consegue resolvê-lo.
const raizMonorepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const nextConfig: NextConfig = {
  reactStrictMode: true,

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
};

export default nextConfig;
