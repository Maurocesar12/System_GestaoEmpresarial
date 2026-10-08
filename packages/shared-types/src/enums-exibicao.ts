/** Valores de exibição de `enums`, sem Zod: o que a tela importa não carrega os schemas. */

/**
 * Para que serve uma categoria financeira.
 *
 * `fixo` e `variavel` classificam despesa e alimentam o custo operacional e a
 * margem. `receita` é para as categorias de entrada — sem ela, "Venda de
 * serviço" tinha de se declarar custo fixo ou variável, o que não significa
 * nada e punha receita ao lado de despesa nos seletores.
 */
export const TIPOS_CUSTO = ['fixo', 'variavel', 'receita'] as const;

/** Canal de envio do lembrete de follow-up. WhatsApp aqui é mensagem *utility*. */
export const CANAIS_LEMBRETE = ['email', 'whatsapp'] as const;
