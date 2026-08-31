import type { MensagemNotificacao } from '../../../../infra/notificacoes/notificador';

/**
 * Monta o texto do lembrete de follow-up.
 *
 * Fica separado do processador de propósito: montar texto é regra de negócio e
 * muda com frequência (redação, assinatura, tom), enquanto o processador cuida
 * de fila, contexto de tenant e status. Separados, dá para testar a redação sem
 * encostar em banco nem em fila.
 *
 * **Limitação conhecida:** hoje `LembreteFollowUp` guarda cliente, canal e data,
 * mas não guarda *o que* dizer. Por isso o texto abaixo é genérico. Quando a
 * regra de negócio do lembrete for fechada (arquitetura §12 — gatilho, canal,
 * destinatário, comportamento sem resposta), o provável é o lembrete ganhar um
 * campo de mensagem e esta função passar a usá-lo.
 */
export interface DadosMensagemLembrete {
  clienteNome: string;
  clienteEmail: string | null;
  /** Nome da empresa dona do lembrete — assina a mensagem. */
  empresaNome: string;
}

export function montarMensagemLembrete(dados: DadosMensagemLembrete): MensagemNotificacao {
  const { clienteNome, clienteEmail, empresaNome } = dados;

  const corpo = [
    `Olá, ${primeiroNome(clienteNome)}.`,
    '',
    `Passando para manter contato com você em nome da ${empresaNome}.`,
    '',
    'Se precisar de alguma coisa ou quiser reagendar, é só responder esta mensagem.',
    '',
    `Equipe ${empresaNome}`,
  ].join('\n');

  return {
    // `?? ''` em vez de estourar aqui: quem decide o que fazer com cliente sem
    // e-mail é o notificador, que trata endereço vazio como falha permanente e
    // devolve uma mensagem de erro que o suporte entende.
    destinatario: clienteEmail ?? '',
    assunto: `Um lembrete da ${empresaNome}`,
    corpo,
  };
}

/**
 * Primeiro nome, para a saudação não ficar com nome completo.
 *
 * Cai para o nome inteiro quando não há espaço — e para um cumprimento neutro
 * quando o cadastro tem só espaços em branco, que é melhor do que enviar
 * "Olá, ." para o cliente.
 */
function primeiroNome(nomeCompleto: string): string {
  const [primeiro] = nomeCompleto.trim().split(/\s+/);

  return primeiro || 'tudo bem';
}
