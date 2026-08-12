import { z } from 'zod';

/**
 * Variáveis de ambiente da API.
 *
 * Validadas na subida do processo: é melhor a API se recusar a iniciar com
 * configuração faltando do que descobrir em produção, no meio de uma
 * requisição, que `JWT_SECRET` era `undefined`.
 *
 * Segredo nenhum vive no repositório (arquitetura §9.3) — em produção vêm das
 * variáveis do Render.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),

  /** Prefixo global das rotas. `/health` fica de fora (health check do Render). */
  API_PREFIX: z.string().default('api'),

  /**
   * Origens liberadas no CORS, separadas por vírgula.
   * Nunca `*` — a API responde com credenciais (arquitetura §9.2).
   */
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  /**
   * Conexão da aplicação. Precisa ser um usuário **sem** `BYPASSRLS`
   * (arquitetura §4.3): com BYPASSRLS, as políticas de RLS seriam ignoradas em
   * silêncio e o isolamento entre empresas deixaria de existir.
   */
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória — rode scripts/setup-database.ps1'),

  /** Banco usado pelos testes automatizados. Só é lido em NODE_ENV=test. */
  TEST_DATABASE_URL: z.string().optional(),

  /** Conexão do painel interno: usuário COM BYPASSRLS, isolada da aplicação. */
  ADMIN_DATABASE_URL: z.string().optional(),

  /** Mínimo de 32 caracteres — segredo curto de JWT é assinatura quebrável. */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa ter ao menos 32 caracteres'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  /** Redis do BullMQ (Upstash). Obrigatório quando a fila de lembretes entrar. */
  REDIS_URL: z.string().optional(),

  /** Rate limit global: janela em milissegundos e teto de requisições. */
  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Usado como `validate` do ConfigModule. Em caso de erro, lista todas as
 * variáveis com problema de uma vez em vez de falhar na primeira.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const resultado = envSchema.safeParse(config);

  if (!resultado.success) {
    const problemas = resultado.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuração de ambiente inválida:\n${problemas}`);
  }

  return resultado.data;
}
