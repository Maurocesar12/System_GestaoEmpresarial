import { formatarDocumento, formatarTelefone } from '@gestao/shared-types';

/**
 * Máscaras aplicadas quando o usuário sai do campo.
 *
 * A escolha de formatar no `blur`, e não a cada tecla, é deliberada. Máscara
 * que reage à digitação atrapalha em dois casos comuns: apagar um caractere no
 * meio do número faz o cursor pular, e colar um valor do WhatsApp muitas vezes
 * é rejeitado no meio do caminho. Formatando ao sair, a pessoa digita como
 * quiser — "11912345678", "(11) 91234-5678", ou com pontos — e o campo se
 * arruma sozinho quando ela segue para o próximo.
 *
 * A formatação é só apresentação: o schema em `shared-types` remove tudo que
 * não é dígito antes de validar, e o banco guarda apenas os números. Por isso
 * um valor mascarado nunca chega "sujo" à API.
 */

/**
 * Aplica a máscara quando o valor está completo.
 *
 * Incompleto fica como está de propósito: mascarar "1191" viraria "(11) 91",
 * dando a impressão de que o campo foi aceito. Deixando cru, o erro de
 * validação aparece com o que a pessoa realmente digitou.
 */
function mascarar(valor: string, formatador: (digitos: string) => string): string {
  const digitos = valor.replace(/\D/g, '');

  if (!digitos) return '';

  // Os formatadores de `shared-types` devolvem a entrada intacta quando o
  // número de dígitos não bate com nenhum formato conhecido.
  return formatador(digitos);
}

/** `11912345678` vira `(11) 91234-5678`. Aceita 10 ou 11 dígitos. */
export function mascararTelefone(valor: string): string {
  return mascarar(valor, formatarTelefone);
}

/** `12345678901` vira `123.456.789-01`; 14 dígitos viram CNPJ. */
export function mascararDocumento(valor: string): string {
  return mascarar(valor, formatarDocumento);
}
