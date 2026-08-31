import { montarMensagemLembrete } from './mensagem-lembrete';

const BASE = {
  clienteNome: 'Maria Souza Lima',
  clienteEmail: 'maria@exemplo.com',
  empresaNome: 'Oficina do João',
};

describe('montarMensagemLembrete', () => {
  it('cumprimenta pelo primeiro nome e assina com a empresa', () => {
    const mensagem = montarMensagemLembrete(BASE);

    expect(mensagem.corpo).toContain('Olá, Maria.');
    expect(mensagem.corpo).toContain('Equipe Oficina do João');
    expect(mensagem.corpo).not.toContain('Souza');
  });

  it('endereça a mensagem ao e-mail do cliente', () => {
    expect(montarMensagemLembrete(BASE).destinatario).toBe('maria@exemplo.com');
  });

  it('usa o nome inteiro quando ele não tem sobrenome', () => {
    const mensagem = montarMensagemLembrete({ ...BASE, clienteNome: 'Maria' });

    expect(mensagem.corpo).toContain('Olá, Maria.');
  });

  it('evita saudação quebrada quando o cadastro tem só espaços', () => {
    // Sem isso, o cliente receberia "Olá, ." — pior do que um cumprimento
    // genérico.
    const mensagem = montarMensagemLembrete({ ...BASE, clienteNome: '   ' });

    expect(mensagem.corpo).toContain('Olá, tudo bem.');
  });

  it('deixa o destinatário vazio quando o cliente não tem e-mail', () => {
    // Quem transforma isso em erro é o notificador, que classifica endereço
    // vazio como falha permanente — aqui só não se inventa um destinatário.
    const mensagem = montarMensagemLembrete({ ...BASE, clienteEmail: null });

    expect(mensagem.destinatario).toBe('');
  });

  it('identifica a empresa no assunto', () => {
    expect(montarMensagemLembrete(BASE).assunto).toContain('Oficina do João');
  });
});
