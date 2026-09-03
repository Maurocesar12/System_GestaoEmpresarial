import { Injectable } from '@nestjs/common';
import type { Transporter } from 'nodemailer';
import { ErroDeNotificacao, Notificador, type MensagemNotificacao } from './notificador';

/**
 * Envio real por e-mail, via SMTP.
 *
 * O transporte chega pronto pelo construtor em vez de ser criado aqui dentro.
 * Isso mantém a classe testável: o teste passa um transporte de mentira e
 * verifica o que foi enviado, sem subir servidor de e-mail nenhum. Quem monta o
 * transporte de verdade é o `NotificacoesModule`.
 */
@Injectable()
export class NotificadorEmail extends Notificador {
  override readonly modo = 'smtp' as const;

  constructor(
    private readonly transporte: Transporter,
    /** Remetente no formato `Nome <endereco@dominio>`, vindo de `EMAIL_REMETENTE`. */
    private readonly remetente: string,
  ) {
    super();
  }

  async enviar(mensagem: MensagemNotificacao): Promise<void> {
    const destinatario = mensagem.destinatario.trim();

    // Checado antes de falar com o servidor: um cliente cadastrado sem e-mail é
    // situação comum, e o erro precisa dizer isso em vez de devolver uma
    // recusa genérica do SMTP.
    if (!destinatario) {
      throw new ErroDeNotificacao('Destinatário sem endereço de e-mail cadastrado.', true);
    }

    try {
      await this.transporte.sendMail({
        from: this.remetente,
        to: destinatario,
        subject: mensagem.assunto,
        text: mensagem.corpo,
      });
    } catch (erro) {
      throw new ErroDeNotificacao(
        `Falha ao enviar e-mail para ${destinatario}: ${descreverErro(erro)}`,
        ehRecusaDefinitiva(erro),
      );
    }
  }
}

/**
 * Traduz o código de resposta do SMTP em "adianta tentar de novo?".
 *
 * O protocolo separa as duas famílias justamente para isso: 5xx é recusa
 * definitiva (caixa inexistente, domínio inválido) e 4xx é problema passageiro
 * (servidor ocupado, limite momentâneo). Erro sem código nenhum — queda de
 * rede, DNS fora — é tratado como temporário, que é a suposição segura: no pior
 * caso a fila tenta de novo e falha de novo, enquanto o contrário descartaria
 * um lembrete que teria sido entregue.
 */
function ehRecusaDefinitiva(erro: unknown): boolean {
  const codigo = (erro as { responseCode?: number }).responseCode;

  return typeof codigo === 'number' && codigo >= 500 && codigo < 600;
}

function descreverErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}
