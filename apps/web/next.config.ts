import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

// `fileURLToPath` em vez de `new URL(...).pathname`: no Windows o pathname vem
// como "/C:/..." e o Next não consegue resolvê-lo.
const raizMonorepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Falhar o build em erro de tipo é intencional: erro que passa batido no
  // build vira bug em produção.
  typescript: { ignoreBuildErrors: false },

  // Necessário no monorepo: sem isso o Next infere a raiz errada ao rastrear
  // os arquivos do build.
  outputFileTracingRoot: raizMonorepo,
};

export default nextConfig;
