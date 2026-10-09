/**
 * Como ler cada sinal de conta em voz alta.
 *
 * O símbolo é lido de forma inconsistente pelos leitores de tela ("−" às vezes
 * some, "÷" quase nunca é anunciado), e uma conta sem o sinal vira uma lista de
 * nomes. Quem desenha uma conta mostra o símbolo e esconde esta frase para os
 * olhos (`sr-only`).
 *
 * Num módulo próprio, e não junto do glossário, de propósito: o balão de
 * explicação é um componente de cliente e precisa só disto. Importar o glossário
 * traria o texto de todos os conceitos para o pacote de qualquer tela.
 */
export const NOME_DO_OPERADOR = {
  '=': 'é igual a',
  '+': 'mais',
  '−': 'menos',
  '÷': 'dividido por',
} as const;
