// `eslint-config-next` já exporta flat config a partir do Next 16 — importar
// direto, sem FlatCompat (a ponte legada quebra em versões novas do ESLint).
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default config;
