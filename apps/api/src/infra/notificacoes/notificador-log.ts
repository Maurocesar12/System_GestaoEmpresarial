import { Injectable, Logger } from '@nestjs/common';
import { Notificador, type MensagemNotificacao } from './notificador';

/**
 * Implementação de desenvolvimento: escreve a mensagem no log em vez de enviar.
 *
 * É o que roda quando `SMTP_URL` está vazia. Serve a dois propósitos:
 *
 * 1. Você consegue exercitar o fluxo inteiro de lembretes na sua máquina sem
 *    configurar conta de e-mail nenhuma.
 * 2. Um teste manual não dispara mensagem de verdade para o cliente real que
 *    estiver no banco de desenvolvimento.
 *
 * Não é um "modo desligado": ela cumpre o contrato e completa o envio com
 * sucesso. Quem chama não sabe — nem precisa saber — qual das duas
 * implementações está do outro lado.
 */
@Injectable()
export class NotificadorLog extends Notificador {
  private readonly logger = new Logger(NotificadorLog.name);

  enviar(mensagem: MensagemNotificacao): Promise<void> {
    this.logger.log(
      `[envio simulado] para: ${mensagem.destinatario} | assunto: ${mensagem.assunto}\n${mensagem.corpo}`,
    );

    return Promise.resolve();
  }
}
