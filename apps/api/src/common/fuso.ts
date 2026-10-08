/**
 * O fuso da empresa, num lugar só.
 *
 * O servidor de produção roda em UTC; quem usa o sistema está no Brasil. Toda
 * conversão entre "o que a pessoa digitou ou vê" e "o instante gravado" passa
 * por aqui. Antes, cada módulo escolhia um jeito, e um serviço executado às
 * 22h caía num dia no histórico e no dia seguinte no financeiro.
 *
 * Offset fixo de -03:00: o Brasil não tem horário de verão desde 2019. Se
 * voltar a ter, só este arquivo muda.
 */
export const FUSO_EMPRESA = 'America/Sao_Paulo';
const OFFSET_EMPRESA = '-03:00';

/**
 * `"2026-08-20T14:30"`, como o `<input type="datetime-local">` envia, vira o
 * instante das 14:30 **de Brasília**.
 *
 * `new Date("2026-08-20T14:30")` interpretaria no fuso do servidor: certo na
 * máquina de quem desenvolve, três horas errado no Render.
 */
export function instanteDeHorarioLocal(valor: string): Date {
  const [dia, hora = '00:00'] = valor.split('T');
  return new Date(`${dia}T${hora.slice(0, 5)}:00${OFFSET_EMPRESA}`);
}

/** Primeiro instante de um dia (`AAAA-MM-DD`) em Brasília: para filtros "de". */
export function inicioDoDia(dia: string): Date {
  return instanteDeHorarioLocal(`${dia}T00:00`);
}

/** Último instante de um dia em Brasília: para filtros "até", que incluem o dia todo. */
export function fimDoDia(dia: string): Date {
  return new Date(inicioDoDia(dia).getTime() + 24 * 60 * 60 * 1000 - 1);
}

/** O dia (`AAAA-MM-DD`) em que um instante cai em Brasília — não em UTC. */
export function diaEmSaoPaulo(instante: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_EMPRESA }).format(instante);
}
