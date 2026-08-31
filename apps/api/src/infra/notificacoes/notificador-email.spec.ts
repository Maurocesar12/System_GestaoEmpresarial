import type { Transporter } from 'nodemailer';
import { NotificadorEmail } from './notificador-email';
import { ErroDeNotificacao } from './notificador';

/**
 * Transporte de mentira: registra o que seria enviado, ou estoura o erro pedido.
 * Evita depender de servidor SMTP para testar as regras da classe.
 *
 * Devolve o mock separado do transporte porque as asserções são feitas em cima
 * dele — `expect(transporte.sendMail)` leria o método solto do objeto, algo que
 * o ESLint barra justamente por costumar esconder erro de `this`.
 */
function criarTransporte(erro?: Error) {
  const sendMail = jest.fn(() => (erro ? Promise.reject(erro) : Promise.resolve({})));

  return { transporte: { sendMail } as unknown as Transporter, sendMail };
}

const REMETENTE = 'Gestão <nao-responda@exemplo.com.br>';

const MENSAGEM = {
  destinatario: 'maria@exemplo.com',
  assunto: 'Retorno agendado',
  corpo: 'Olá, Maria. Passando para lembrar do seu retorno.',
};

describe('NotificadorEmail', () => {
  it('entrega a mensagem ao transporte com o remetente configurado', async () => {
    const { transporte, sendMail } = criarTransporte();

    await new NotificadorEmail(transporte, REMETENTE).enviar(MENSAGEM);

    expect(sendMail).toHaveBeenCalledWith({
      from: REMETENTE,
      to: 'maria@exemplo.com',
      subject: 'Retorno agendado',
      text: 'Olá, Maria. Passando para lembrar do seu retorno.',
    });
  });

  it('trata destinatário vazio como falha permanente, sem chamar o servidor', async () => {
    // Cliente cadastrado sem e-mail é caso comum. Insistir nele só ocuparia a
    // fila repetindo um erro que nunca vai mudar sozinho.
    const { transporte, sendMail } = criarTransporte();
    const notificador = new NotificadorEmail(transporte, REMETENTE);

    await expect(notificador.enviar({ ...MENSAGEM, destinatario: '   ' })).rejects.toMatchObject({
      permanente: true,
    });

    expect(sendMail).not.toHaveBeenCalled();
  });

  it('classifica recusa 5xx do SMTP como permanente', async () => {
    const { transporte } = criarTransporte(
      Object.assign(new Error('Mailbox unavailable'), { responseCode: 550 }),
    );

    await expect(
      new NotificadorEmail(transporte, REMETENTE).enviar(MENSAGEM),
    ).rejects.toMatchObject({ permanente: true });
  });

  it('classifica resposta 4xx do SMTP como temporária', async () => {
    // 4xx é o servidor dizendo "agora não" — repetir mais tarde tem chance real
    // de entregar.
    const { transporte } = criarTransporte(
      Object.assign(new Error('Try again later'), { responseCode: 451 }),
    );

    await expect(
      new NotificadorEmail(transporte, REMETENTE).enviar(MENSAGEM),
    ).rejects.toMatchObject({ permanente: false });
  });

  it('trata erro sem código de resposta como temporário', async () => {
    // Queda de rede ou DNS fora não trazem código SMTP. Assumir "temporário" é
    // a escolha segura: no pior caso a fila tenta de novo, enquanto o contrário
    // descartaria um lembrete que teria sido entregue.
    const { transporte } = criarTransporte(new Error('ECONNREFUSED'));

    await expect(
      new NotificadorEmail(transporte, REMETENTE).enviar(MENSAGEM),
    ).rejects.toMatchObject({ permanente: false });
  });

  it('preserva o endereço no texto do erro, para aparecer no log do lembrete', async () => {
    const { transporte } = criarTransporte(new Error('ECONNREFUSED'));
    const notificador = new NotificadorEmail(transporte, REMETENTE);

    await expect(notificador.enviar(MENSAGEM)).rejects.toBeInstanceOf(ErroDeNotificacao);
    await expect(notificador.enviar(MENSAGEM)).rejects.toThrow(/maria@exemplo\.com/);
  });
});
