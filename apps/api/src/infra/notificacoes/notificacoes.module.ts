import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import type { Env } from '../../config/env.schema';
import { NotificadorEmail } from './notificador-email';
import { NotificadorLog } from './notificador-log';
import { Notificador } from './notificador';

/**
 * Limites do transporte SMTP.
 *
 * Os padrões do nodemailer são generosos demais para um servidor: o
 * `socketTimeout` vem em **dez minutos**, e um servidor de e-mail que aceita a
 * conexão e para de responder seguraria a requisição — ou o job de lembretes —
 * por todo esse tempo. Um minuto é folgado para entregar uma mensagem de texto
 * e curto o bastante para a falha aparecer enquanto alguém ainda está olhando.
 *
 * `pool` reaproveita a conexão entre envios. A varredura de lembretes manda em
 * rajada, e sem o pool cada mensagem abre e fecha uma conexão SMTP nova —
 * lento, e o caminho mais rápido para um provedor começar a recusar por
 * excesso de conexões.
 */
const OPCOES_SMTP = {
  pool: true,
  maxConnections: 3,
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 60_000,
} as const;

/**
 * Envio de notificações.
 *
 * A decisão de qual implementação usar acontece uma vez só, aqui, na subida da
 * aplicação — e não espalhada em `if (produção)` por dentro do domínio.
 *
 * Diferente do `PrismaModule`, este módulo **não** é `@Global`: só quem envia
 * mensagem precisa dele, e um import explícito deixa visível quais partes do
 * sistema falam com o mundo externo.
 */
@Module({
  providers: [
    {
      // O token é a própria classe abstrata. Quem depende escreve
      // `constructor(private readonly notificador: Notificador)` e recebe a
      // implementação escolhida abaixo, sem saber qual das duas é.
      provide: Notificador,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Notificador => {
        const logger = new Logger('NotificacoesModule');
        const smtpUrl = config.get('SMTP_URL', { infer: true });

        // Sem SMTP configurado a aplicação continua subindo, de propósito: em
        // desenvolvimento o esperado é exatamente não ter servidor de e-mail.
        // O aviso existe para que isso nunca passe despercebido em produção.
        if (!smtpUrl) {
          logger.warn('SMTP_URL não configurada — os e-mails serão apenas registrados no log.');

          return new NotificadorLog();
        }

        return new NotificadorEmail(
          createTransport(smtpUrl, OPCOES_SMTP),
          config.get('EMAIL_REMETENTE', { infer: true }),
        );
      },
    },
  ],
  exports: [Notificador],
})
export class NotificacoesModule {}
