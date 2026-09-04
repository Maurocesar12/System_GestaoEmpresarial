import { validateEnv } from './env.schema';

const BASE = {
  DATABASE_URL: 'postgresql://usuario:senha@localhost:5432/gestao',
  JWT_SECRET: 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres',
};

describe('configuração de e-mail', () => {
  it('mantém o modo simulado quando SMTP_URL está vazia', () => {
    const config = validateEnv({ ...BASE, SMTP_URL: '' });

    expect(config.SMTP_URL).toBeUndefined();
  });

  it('aceita SMTP com TLS e remetente no formato esperado', () => {
    const config = validateEnv({
      ...BASE,
      SMTP_URL: 'smtps://resend:re_chave@smtp.resend.com:465',
      EMAIL_REMETENTE: 'Minha Empresa <notificacoes@empresa.com.br>',
    });

    expect(config.SMTP_URL).toContain('smtp.resend.com');
  });

  it('recusa protocolo que não seja SMTP', () => {
    expect(() => validateEnv({ ...BASE, SMTP_URL: 'https://smtp.resend.com' })).toThrow(
      /smtp:\/\/ ou smtps:\/\//,
    );
  });

  it('recusa remetente local quando o SMTP está ativo em produção', () => {
    expect(() =>
      validateEnv({
        ...BASE,
        NODE_ENV: 'production',
        SMTP_URL: 'smtps://resend:re_chave@smtp.resend.com:465',
      }),
    ).toThrow(/domínio verificado/);
  });
});

describe('configuração de inteligência artificial', () => {
  it('usa demonstração quando a chave está vazia', () => {
    const config = validateEnv({ ...BASE, OPENAI_API_KEY: '' });

    expect(config.OPENAI_API_KEY).toBeUndefined();
    expect(config.OPENAI_MODEL).toBe('gpt-5.6-luna');
  });

  it('aceita chave e preços configuráveis para acompanhar o custo', () => {
    const config = validateEnv({
      ...BASE,
      OPENAI_API_KEY: 'sk-projeto-chave-comprida-de-teste',
      OPENAI_CUSTO_INPUT_USD_MILHAO: '0.25',
      OPENAI_CUSTO_OUTPUT_USD_MILHAO: '1.50',
    });

    expect(config.OPENAI_API_KEY).toContain('sk-');
    expect(config.OPENAI_CUSTO_OUTPUT_USD_MILHAO).toBe(1.5);
  });
});
