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

export function formatarHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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
  const hoje = new Date();
  const amanha = new Date(hoje);
  amanha.setDate(hoje.getDate() + 1);

  if (iso === paraISO(hoje)) return 'Hoje';
  if (iso === paraISO(amanha)) return 'Amanhã';

  return dataLocalDeISO(iso).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

/** `2026-08-13T14:30:00Z` → `hoje às 14:30`. Usado nas listas do painel. */
export function formatarQuando(iso: string): string {
  return `${formatarDiaAgenda(iso.slice(0, 10)).toLowerCase()} às ${formatarHora(iso)}`;
}

/**
 * O formato que `<input type="datetime-local">` exige.
 *
 * Montado pelos componentes locais da data, e não por `toISOString()`: este
 * último converte para UTC, e o campo apareceria com a hora deslocada.
 */
export function paraCampoDatetimeLocal(iso: string): string {
  const data = new Date(iso);

  return (
    `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}` +
    `T${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`
  );
}

/** Sugestão padrão para agendar: a próxima hora fechada. */
export function proximaHoraCheia(): string {
  const data = new Date();
  data.setHours(data.getHours() + 1, 0, 0, 0);

  return paraCampoDatetimeLocal(data.toISOString());
}

function paraISO(data: Date): string {
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;
}

function doisDigitos(valor: number): string {
  return String(valor).padStart(2, '0');
}
