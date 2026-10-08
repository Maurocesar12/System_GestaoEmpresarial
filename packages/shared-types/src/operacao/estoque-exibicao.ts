import type { UnidadeMaterial } from './estoque';

/** Valores de exibição de `estoque`, sem Zod: o que a tela importa não carrega os schemas. */

export const ROTULO_UNIDADE: Record<UnidadeMaterial, string> = {
  un: 'Unidade',
  pc: 'Peça',
  par: 'Par',
  cx: 'Caixa',
  rolo: 'Rolo',
  m: 'Metro',
  m2: 'Metro quadrado',
  m3: 'Metro cúbico',
  kg: 'Quilo',
  g: 'Grama',
  l: 'Litro',
  ml: 'Mililitro',
};

export const UNIDADES_MATERIAL = [
  'un',
  'pc',
  'par',
  'cx',
  'rolo',
  'm',
  'm2',
  'm3',
  'kg',
  'g',
  'l',
  'ml',
] as const;
