import { z } from 'zod';

/**
 * Variáveis públicas do frontend.
 *
 * Precisam ser referenciadas literalmente como `process.env.NEXT_PUBLIC_*`:
 * o Next substitui essas expressões em tempo de build, e acesso dinâmico
 * (`process.env[nome]`) resulta em `undefined` no browser.
 */
const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url('NEXT_PUBLIC_API_URL precisa ser uma URL válida'),
});

const resultado = envSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});

if (!resultado.success) {
  const problemas = resultado.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Configuração de ambiente inválida:\n${problemas}`);
}

export const env = resultado.data;
