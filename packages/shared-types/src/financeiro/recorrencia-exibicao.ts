import type { Periodicidade } from './recorrencia';

/** Valores de exibição de `recorrencia`, sem Zod: o que a tela importa não carrega os schemas. */

export const PERIODICIDADES = ['semanal', 'mensal', 'trimestral', 'anual'] as const;

export const ROTULO_PERIODICIDADE: Record<Periodicidade, string> = {
  semanal: 'Toda semana',
  mensal: 'Todo mês',
  trimestral: 'A cada três meses',
  anual: 'Todo ano',
};
