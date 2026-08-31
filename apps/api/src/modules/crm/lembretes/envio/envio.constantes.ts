/**
 * Nomes e formatos compartilhados entre o agendador (quem põe na fila) e o
 * processador (quem tira). Ficam juntos aqui para que os dois lados nunca
 * discordem sobre o nome da fila ou sobre o formato do job.
 */

/** Nome da fila no Redis. */
export const FILA_LEMBRETES = 'lembretes';

/** Nome do job dentro da fila. */
export const JOB_ENVIAR_LEMBRETE = 'enviar-lembrete';

/**
 * O que viaja no job.
 *
 * O `tenantId` é obrigatório e não é um detalhe: o worker roda fora de qualquer
 * requisição, então é este campo que devolve o contexto de empresa antes de
 * qualquer acesso ao banco (arquitetura §4.3). Job sem tenant falha — nunca
 * roda sem escopo.
 */
export interface PayloadEnvioLembrete {
  lembreteId: string;
  tenantId: string;
}
