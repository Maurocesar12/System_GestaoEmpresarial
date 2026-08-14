import { z } from 'zod';

/**
 * Campo opcional de formulário, normalizado para `null`.
 *
 * Um `<input>` não preenchido envia `""`, e o banco precisa de `NULL` — sem a
 * conversão, "sem telefone" e "telefone vazio" viram coisas diferentes nas
 * consultas.
 *
 * ## Por que aceita `null` na entrada
 *
 * Este detalhe existe por causa de um bug real. Os mesmos schemas são validados
 * **duas vezes**: no formulário, para dar resposta imediata a quem digita, e na
 * Server Action, porque validação de cliente nunca é garantia.
 *
 * A primeira validação transforma `""` em `null`. Se o schema não aceitasse
 * `null` na entrada, a segunda validação — recebendo o resultado da primeira —
 * falharia com "Invalid input" em todo campo opcional não preenchido. O
 * cadastro de cliente quebrava exatamente assim, e a mensagem de erro não dava
 * pista nenhuma, porque os campos culpados (UTM) nem aparecem na tela.
 *
 * Aceitar `null` torna o schema **idempotente**: validar o resultado de uma
 * validação devolve o mesmo resultado. Há teste garantindo isso.
 */
export function opcional<T extends z.ZodType>(schema: T) {
  return z
    .union([schema, z.literal(''), z.null()])
    .optional()
    .transform((valor) => (valor === '' || valor === undefined || valor === null ? null : valor));
}

/** Texto opcional com limite de tamanho — o caso mais comum de `opcional`. */
export function textoOpcional(maximo: number) {
  return opcional(z.string().trim().max(maximo));
}
