/** Valores de exibição de `atendimentos`, sem Zod: o que a tela importa não carrega os schemas. */

/** Data de hoje no formato do campo, para preencher o formulário. */
export function hojeISO(): string {
  // `toISOString` usa UTC e viraria o dia à noite no Brasil. Montar a partir
  // dos componentes locais mantém "hoje" igual ao hoje de quem está digitando.
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');

  return `${agora.getFullYear()}-${mes}-${dia}`;
}
