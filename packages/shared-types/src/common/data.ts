/**
 * Datas que vêm da API como texto ISO.
 *
 * ## A armadilha que estas funções existem para evitar
 *
 * `new Date('2026-08-13')` é interpretado como **meia-noite UTC**. No fuso do
 * Brasil (UTC-3) isso é 21h do dia 12 — então `toLocaleDateString('pt-BR')`
 * exibe **12/08/2026**. Um agendamento cai no dia anterior, e um lançamento
 * financeiro migra para o mês passado sem que nada acuse erro.
 *
 * A correção é montar a data pelos componentes, que o construtor interpreta no
 * fuso local: `new Date(2026, 7, 13)` é 13/08 em qualquer fuso.
 *
 * Só use estas funções com datas puras (`YYYY-MM-DD`). Para instantes com hora
 * (`criadoEm`, `atualizadoEm`), o `Date` normal está certo — ali o fuso importa.
 */

/** Converte `"2026-08-13"` em uma `Date` à meia-noite **local**. */
export function dataLocalDeISO(iso: string): Date {
  const [ano, mes, dia] = iso.slice(0, 10).split('-').map(Number);
  return new Date(ano!, mes! - 1, dia!);
}

/** Formata `"2026-08-13"` como `13/08/2026`, ou `13/08` sem o ano. */
export function formatarDataISO(iso: string, opcoes?: { comAno?: boolean }): string {
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return opcoes?.comAno === false ? `${dia}/${mes}` : `${dia}/${mes}/${ano}`;
}

/** Quantos dias inteiros se passaram desde a data informada. */
export function diasDesde(iso: string, referencia = new Date()): number {
  const MS_POR_DIA = 24 * 60 * 60 * 1000;
  const inicio = dataLocalDeISO(iso).getTime();
  const hoje = new Date(
    referencia.getFullYear(),
    referencia.getMonth(),
    referencia.getDate(),
  ).getTime();

  return Math.max(0, Math.round((hoje - inicio) / MS_POR_DIA));
}
