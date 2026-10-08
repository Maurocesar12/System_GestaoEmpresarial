/** Medidas, tipos e formatadores compartilhados pelas partes do gráfico do painel. */

export const LARGURA = 820;

export const ALTURA = 300;

export const MARGEM = { topo: 20, direita: 24, baixo: 46, esquerda: 68 };

export const FORMATADOR_COMPACTO = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export type Visao = 'fluxo' | 'acumulado';

export interface Ponto {
  mes: string;
  entradas: number;
  saidas: number;
  saldo: number;
  /** Soma dos saldos desde o início da janela — a curva do caixa no período. */
  acumulado: number;
  /** Diferença para o mês anterior, calculada pela API. `null` no primeiro mês. */
  variacaoSaldo: string | null;
}

export function formatarMesCurto(mes: string): string {
  return new Date(`${mes}-01T12:00:00Z`).toLocaleDateString('pt-BR', {
    month: 'short',
    timeZone: 'UTC',
  });
}

/**
 * "setembro de 2026" com a inicial maiúscula — e só ela.
 *
 * A classe `capitalize` do CSS levantaria também o "de", produzindo "Setembro
 * De 2026". Fazer no texto resolve nos três lugares que mostram o mês por
 * extenso, sem regra de estilo em cada um.
 */
export function formatarMesCompleto(mes: string): string {
  const texto = new Date(`${mes}-01T12:00:00Z`).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
