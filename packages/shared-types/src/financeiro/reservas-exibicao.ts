import type { MovimentoReserva } from './reservas';

/** Valores de exibição de `reservas`, sem Zod: o que a tela importa não carrega os schemas. */

export const ROTULO_MOVIMENTO_RESERVA: Record<MovimentoReserva, string> = {
  aporte: 'Guardar',
  resgate: 'Resgatar',
};
