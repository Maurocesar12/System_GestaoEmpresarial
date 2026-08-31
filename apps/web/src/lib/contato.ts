/**
 * Links de contato direto.
 *
 * Existem porque o gesto mais comum de quem olha o funil não é editar o
 * cadastro: é falar com a pessoa. Sem estes atalhos, o caminho era selecionar o
 * telefone com o mouse, copiar, abrir o WhatsApp e colar — quatro passos para
 * algo que acontece dezenas de vezes por dia.
 */

/**
 * Código do país fixo em 55.
 *
 * O produto é vendido no Brasil e o schema de telefone valida DDD brasileiro
 * (`telefoneSchema`, em shared-types). Quando houver cliente fora do país, o
 * país precisa virar dado do cadastro — e não uma adivinhação aqui.
 */
const PAIS = '55';

function apenasDigitos(telefone: string): string {
  return telefone.replace(/\D/g, '');
}

/**
 * Conversa no WhatsApp.
 *
 * `wa.me` é o formato oficial e resolve sozinho para onde mandar: aplicativo no
 * celular, WhatsApp Web no computador.
 */
export function linkWhatsApp(telefone: string | null): string | null {
  if (!telefone) return null;

  const digitos = apenasDigitos(telefone);

  // Menos que DDD + 8 dígitos não é telefone utilizável; melhor não oferecer o
  // atalho do que abrir uma conversa com número quebrado.
  if (digitos.length < 10) return null;

  return `https://wa.me/${PAIS}${digitos}`;
}

/** Chamada telefônica. No computador, abre o aplicativo padrão de chamadas. */
export function linkTelefone(telefone: string | null): string | null {
  if (!telefone) return null;

  const digitos = apenasDigitos(telefone);

  if (digitos.length < 10) return null;

  return `tel:+${PAIS}${digitos}`;
}

export function linkEmail(email: string | null): string | null {
  return email ? `mailto:${email}` : null;
}
