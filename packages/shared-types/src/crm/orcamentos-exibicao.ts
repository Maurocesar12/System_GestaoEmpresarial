import type { AcaoOrcamento } from './orcamentos';

/** Valores de exibição de `orcamentos`, sem Zod: o que a tela importa não carrega os schemas. */

export const ROTULO_ACAO: Record<AcaoOrcamento, string> = {
  aprovar: 'Aprovar',
  recusar: 'Recusar',
  reabrir: 'Reabrir',
};
