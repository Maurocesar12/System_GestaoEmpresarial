/** Valores de exibição de `chat`, sem Zod: o que a tela importa não carrega os schemas. */

/**
 * Quantas mensagens anteriores viajam junto com a pergunta.
 *
 * O histórico é o que faz "e no mês passado?" significar alguma coisa. Dez
 * mensagens cobrem uma conversa inteira de suporte e mantêm o custo por
 * pergunta previsível — o contexto do modelo cresce com cada uma delas.
 */
export const LIMITE_HISTORICO_CHAT = 10;
