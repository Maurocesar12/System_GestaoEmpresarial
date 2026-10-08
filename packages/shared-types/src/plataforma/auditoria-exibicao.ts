/** Valores de exibição de `auditoria`, sem Zod: o que a tela importa não carrega os schemas. */

/**
 * Teto de uma exclusão em lote.
 *
 * A remoção roda numa transação só — o que garante que o histórico e o registro
 * da própria exclusão nunca divirjam. Transação longa segura conexão do pool e
 * bloqueia linhas, então o lote tem tamanho máximo: a tela pagina de 30 em 30 e
 * nunca chega perto disso.
 */
export const LIMITE_EXCLUSAO_HISTORICO = 100;
