import { z } from 'zod';

/**
 * Contrato do chat do painel.
 *
 * ## Dois assistentes diferentes, não um assistente com desconto
 *
 * O plano Básico tinha uma "IA gratuita" que lia os dados da empresa e
 * respondia com frases montadas por regras. Era o pior dos dois mundos: parecia
 * IA sem ser, gastava consulta ao banco para devolver um resumo que o painel já
 * mostra melhor, e criava a expectativa de uma conversa que ela não sustentava.
 *
 * Passaram a existir dois assistentes com propósitos distintos:
 *
 * - **`ajuda`** (todos os planos): responde sobre o **sistema** — onde fica cada
 *   tela, como cadastrar, o que cada campo significa, por que um número não
 *   bate. Não lê dado nenhum da empresa, e por isso responde na hora, sem custo
 *   e sem risco de vazar informação entre usuários de papéis diferentes.
 *
 * - **`ia`** (plano Premium): conversa de verdade, com modelo de linguagem e com
 *   o contexto do negócio — caixa, funil, agenda, carteira — respeitando as
 *   permissões de quem pergunta.
 *
 * O modo vem do servidor, nunca da tela: é o plano da empresa que decide.
 */

export const MODOS_CHAT = ['ajuda', 'ia'] as const;
export const modoChatSchema = z.enum(MODOS_CHAT);
export type ModoChat = z.infer<typeof modoChatSchema>;

export const AUTORES_CHAT = ['usuario', 'assistente'] as const;
export const autorChatSchema = z.enum(AUTORES_CHAT);
export type AutorChat = z.infer<typeof autorChatSchema>;

export const mensagemChatSchema = z.object({
  autor: autorChatSchema,
  texto: z.string().trim().min(1).max(4_000),
});

export type MensagemChat = z.infer<typeof mensagemChatSchema>;

/**
 * Quantas mensagens anteriores viajam junto com a pergunta.
 *
 * O histórico é o que faz "e no mês passado?" significar alguma coisa. Dez
 * mensagens cobrem uma conversa inteira de suporte e mantêm o custo por
 * pergunta previsível — o contexto do modelo cresce com cada uma delas.
 */
export const LIMITE_HISTORICO_CHAT = 10;

export const chatIaSchema = z.object({
  mensagem: z.string().trim().min(2, 'Digite uma pergunta.').max(1_000, 'Pergunta muito longa.'),
  /**
   * A conversa até aqui, do mais antigo ao mais recente, sem a pergunta atual.
   * Enviado pela tela porque o chat não guarda sessão no servidor: nada do que
   * foi conversado fica armazenado depois da resposta.
   */
  historico: z.array(mensagemChatSchema).max(LIMITE_HISTORICO_CHAT).default([]),
});

export type ChatIaInput = z.infer<typeof chatIaSchema>;

/** Tela do sistema citada por uma resposta de ajuda. */
export interface ReferenciaAjuda {
  titulo: string;
  href: string;
}

export interface ChatIaResponse {
  modo: ModoChat;
  resposta: string;
  /** Próximas perguntas plausíveis, para a conversa não morrer no primeiro turno. */
  sugestoes: string[];
  /** Telas que a resposta menciona. Sempre vazio no modo `ia`. */
  referencias: ReferenciaAjuda[];
  /**
   * `true` quando a resposta veio do modelo de linguagem.
   *
   * No modo `ia` ela pode ser `false`: se a chamada ao fornecedor falhar, a
   * resposta cai para a base local em vez de devolver erro — e a tela precisa
   * poder dizer isso a quem perguntou.
   */
  geradaPorModelo: boolean;
}

/**
 * O que este usuário encontra ao abrir o chat.
 *
 * Consultado antes da primeira pergunta para a tela já abrir com o nome, a
 * descrição e as sugestões certas — sem isso, o chat abriria como "assistente"
 * genérico e só revelaria o que é depois da primeira resposta.
 */
export interface CapacidadesChat {
  modo: ModoChat;
  titulo: string;
  descricao: string;
  saudacao: string;
  sugestoes: string[];
  planoNome: string;
  /** Convite ao Premium, no modo `ajuda`. `null` quando já é Premium. */
  convite: string | null;
}
