import type { AcaoAgendamento } from './agendamentos';

/** Valores de exibição de `agendamentos`, sem Zod: o que a tela importa não carrega os schemas. */

export const ROTULO_ACAO_AGENDAMENTO: Record<AcaoAgendamento, string> = {
  confirmar: 'Confirmar',
  executar: 'Marcar como executado',
  cancelar: 'Cancelar',
  reagendar: 'Reagendar',
};
