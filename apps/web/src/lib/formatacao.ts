import { dataLocalDeISO, formatarDataISO } from '@gestao/shared-types';

/**
 * Formatação de data e hora para a tela.
 *
 * A conversão de `AAAA-MM-DD` para data local mora em `@gestao/shared-types`
 * (`common/data.ts`), e não aqui: a API também precisa dela, e duas
 * implementações da mesma regra de fuso é como um agendamento aparece no dia 12
 * numa tela e no dia 13 na outra.
 *
 * O que fica neste arquivo é o que só o frontend usa — o formato dos campos de
 * formulário e os rótulos relativos ("Hoje", "Amanhã").
 */

/** `2026-08-13` → `13/08`. */
export function formatarDataCurta(iso: string): string {
  return formatarDataISO(iso, { comAno: false });
}

/** `2026-08-13` → `13/08/2026`. */
export function formatarDataCompleta(iso: string): string {
  return formatarDataISO(iso);
}

export function formatarPeriodo(de: string, ate: string): string {
  return `${formatarDataCompleta(de)} a ${formatarDataCompleta(ate)}`;
}

/**
 * Dia e hora de um instante **em Brasília**, onde quer que o código rode.
 *
 * As páginas do painel são renderizadas no servidor da Vercel, que está em
 * UTC. Sem fixar o fuso, um compromisso às 14h aparecia como 17h, e um às 22h
 * aparecia como "amanhã".
 */
const PARTES_EM_BRASILIA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function emBrasilia(instante: Date): { dia: string; hora: string } {
  const partes = Object.fromEntries(
    PARTES_EM_BRASILIA.formatToParts(instante).map((parte) => [parte.type, parte.value]),
  );
  return {
    dia: `${partes.year}-${partes.month}-${partes.day}`,
    hora: `${partes.hour}:${partes.minute}`,
  };
}

/** `2026-08-13T17:30:00Z` → `14:30`. */
export function formatarHora(iso: string): string {
  return emBrasilia(new Date(iso)).hora;
}

export function formatarDataLonga(iso: string): string {
  return dataLocalDeISO(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * O dia como a pessoa fala dele.
 *
 * "Hoje" e "Amanhã" em vez da data são o que faz uma agenda ser lida de relance:
 * ninguém converte "13/08" para "é hoje?" sem pensar.
 */
export function formatarDiaAgenda(iso: string): string {
  const agora = Date.now();
  if (iso === emBrasilia(new Date(agora)).dia) return 'Hoje';
  if (iso === emBrasilia(new Date(agora + 24 * 60 * 60 * 1000)).dia) return 'Amanhã';

  return dataLocalDeISO(iso).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

/** `2026-08-13T17:30:00Z` → `hoje às 14:30`. Usado nas listas do painel. */
export function formatarQuando(iso: string): string {
  const { dia, hora } = emBrasilia(new Date(iso));
  return `${formatarDiaAgenda(dia).toLowerCase()} às ${hora}`;
}

/**
 * O formato que `<input type="datetime-local">` exige, em horário de Brasília
 * — o mesmo fuso em que a API lê o campo de volta.
 */
export function paraCampoDatetimeLocal(iso: string): string {
  const { dia, hora } = emBrasilia(new Date(iso));
  return `${dia}T${hora}`;
}

/** Sugestão padrão para agendar: a próxima hora fechada. */
export function proximaHoraCheia(): string {
  // Brasília tem offset de horas inteiras: virar a hora em UTC é virar lá também.
  const UMA_HORA = 60 * 60 * 1000;
  return paraCampoDatetimeLocal(
    new Date((Math.floor(Date.now() / UMA_HORA) + 1) * UMA_HORA).toISOString(),
  );
}
