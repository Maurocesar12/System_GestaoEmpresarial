/**
 * Contrato de envio de notificações.
 *
 * O resto da aplicação depende **deste arquivo**, e nunca do nodemailer ou de
 * qualquer outro provedor. Quem manda um lembrete só precisa saber "para quem",
 * "assunto" e "texto" — trocar o provedor de e-mail, ou acrescentar WhatsApp
 * mais tarde, vira escrever uma classe nova aqui dentro, sem tocar no domínio.
 */

/**
 * Mensagem pronta para sair.
 *
 * Repare que não há nada de negócio aqui: nem lembrete, nem cliente, nem
 * tenant. Montar o texto a partir do domínio é responsabilidade de quem chama;
 * esta camada só entrega.
 *
 * O corpo é texto puro, sem HTML. É o suficiente para lembrete de follow-up e
 * evita trazer um motor de template antes de haver necessidade real dele.
 */
export interface MensagemNotificacao {
  /** Endereço de destino. Para o canal de e-mail, o e-mail do cliente. */
  destinatario: string;
  assunto: string;
  corpo: string;
}

/**
 * Porta de saída de notificações.
 *
 * É uma classe abstrata, e não uma `interface`, porque o NestJS injeta
 * dependências por um valor que exista em tempo de execução — e `interface` do
 * TypeScript desaparece na compilação. Assim dá para escrever
 * `constructor(private readonly notificador: Notificador)` e deixar o módulo
 * decidir qual implementação entra.
 */
export abstract class Notificador {
  abstract enviar(mensagem: MensagemNotificacao): Promise<void>;
}

/**
 * Falha no envio de uma notificação.
 *
 * O campo `permanente` existe por causa da fila que vai consumir esta camada.
 * Os dois casos pedem reações opostas:
 *
 * - **Permanente** — endereço inválido, cliente sem e-mail cadastrado. Tentar
 *   de novo daria exatamente o mesmo resultado, então o lembrete deve ir direto
 *   para "falhou" em vez de ocupar a fila repetindo o erro.
 * - **Temporário** — servidor SMTP fora do ar, limite do provedor atingido.
 *   Aqui repetir mais tarde tem chance real de funcionar.
 */
export class ErroDeNotificacao extends Error {
  constructor(
    mensagem: string,
    readonly permanente: boolean,
  ) {
    super(mensagem);
    this.name = 'ErroDeNotificacao';
  }
}
