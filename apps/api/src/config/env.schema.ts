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
export const envSchema = z
  .object({
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

    /**
     * Validade do access token, em minutos. Curta de propósito (§9.1): se um
     * token vazar, a janela de uso é pequena. O refresh token é o que evita pedir
     * a senha de novo a cada quinze minutos.
     */
    JWT_ACCESS_TTL_MINUTOS: z.coerce.number().int().positive().max(60).default(15),

    /** Validade do refresh token, em dias — é o tempo que a sessão dura. */
    JWT_REFRESH_TTL_DIAS: z.coerce.number().int().positive().max(90).default(7),

    /**
     * Plano e duração do trial de quem se cadastra.
     *
     * Valores provisórios: a definição comercial dos planos ainda está em aberto
     * (arquitetura §12). Ficam aqui, e não espalhados pelo código, para que a
     * decisão quando vier seja uma linha de configuração.
     */
    ONBOARDING_PLANO_PADRAO: z.string().default('essencial'),
    ONBOARDING_TRIAL_DIAS: z.coerce.number().int().positive().default(14),

    /** Redis do BullMQ (Upstash). Obrigatório quando a fila de lembretes entrar. */
    REDIS_URL: z.string().optional(),

    /**
     * Servidor SMTP usado para enviar e-mail transacional, no formato
     * `smtp://usuario:senha@host:587` (ou `smtps://` para TLS na conexão).
     *
     * Opcional de propósito. Quando está vazia, a API troca o envio real por um
     * envio de mentira que só escreve a mensagem no log — assim o fluxo inteiro
     * roda em desenvolvimento sem exigir uma conta de e-mail de verdade, e
     * ninguém dispara mensagem para cliente real durante um teste manual.
     */
    SMTP_URL: z.preprocess(
      (valor) => (valor === '' ? undefined : valor),
      z
        .url('SMTP_URL precisa ser uma URL válida')
        .refine((valor) => valor.startsWith('smtp://') || valor.startsWith('smtps://'), {
          message: 'SMTP_URL precisa começar com smtp:// ou smtps://',
        })
        .optional(),
    ),

    /**
     * Remetente das mensagens, no formato `Nome <endereco@dominio>`.
     *
     * Precisa ser um endereço do domínio verificado no provedor de e-mail: um
     * remetente que não confere é o motivo mais comum de a mensagem cair em spam.
     */
    EMAIL_REMETENTE: z
      .string()
      .trim()
      .regex(/^.{1,120}\s<[^\s<>@]+@[^\s<>@]+>$/, 'Use o formato Nome <email@dominio.com>')
      .default('Gestão Empresarial <nao-responda@localhost>'),

    /** Endereço público do frontend, usado nos links de convite da equipe. */
    APP_URL: z.url().default('http://localhost:3000'),

    /** Rate limit global: janela em milissegundos e teto de requisições. */
    THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
    THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),
  })
  .superRefine((config, contexto) => {
    if (
      config.NODE_ENV === 'production' &&
      config.SMTP_URL &&
      config.EMAIL_REMETENTE.includes('@localhost')
    ) {
      contexto.addIssue({
        code: 'custom',
        path: ['EMAIL_REMETENTE'],
        message: 'Em produção, use um remetente do domínio verificado no provedor',
      });
    }
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
