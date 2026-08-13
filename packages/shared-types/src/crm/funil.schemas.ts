import { z } from 'zod';

/**
 * Contrato do funil de vendas (arquitetura §6, §7).
 *
 * ## Regras adotadas
 *
 * A §12 deixou as regras do funil em aberto — "pode pular etapa? volta atrás?
 * movimentação automática?". As decisões tomadas aqui, e o porquê:
 *
 * - **Movimentação livre.** O cliente vai de qualquer etapa para qualquer
 *   outra, inclusive para trás. O público é PME de serviço, onde o processo
 *   real raramente é linear: um orçamento recusado volta para follow-up, uma
 *   indicação já chega em "orçamento enviado". Um funil que recusa movimento
 *   viraria motivo para as pessoas pararem de atualizá-lo — e um funil
 *   desatualizado não serve para nada.
 *
 * - **Sem movimentação automática, por ora.** Ligar "orçamento aprovado" a
 *   "mover para Fechado" depende do módulo de Orçamentos, que ainda não existe.
 *   Fica para quando as duas pontas existirem.
 *
 * - **Cliente novo não entra no funil sozinho.** Nem todo cadastro é uma
 *   oportunidade de venda: muita gente cadastra o cliente depois do serviço
 *   feito. Entrar no funil é uma ação explícita.
 *
 * Nenhuma dessas regras está gravada em pedra — todas são fáceis de mudar, e é
 * por isso que estão documentadas em vez de espalhadas pelo código.
 */

export const etapaFormSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome da etapa').max(60),
});

export type EtapaFormInput = z.infer<typeof etapaFormSchema>;

export const moverClienteSchema = z.object({
  clienteId: z.uuid('Cliente inválido'),
  etapaId: z.uuid('Etapa inválida'),
});

export type MoverClienteInput = z.infer<typeof moverClienteSchema>;

/** Reordenação das etapas, na ordem em que devem ficar. */
export const reordenarEtapasSchema = z.object({
  etapaIds: z.array(z.uuid()).min(1, 'Informe ao menos uma etapa'),
});

export type ReordenarEtapasInput = z.infer<typeof reordenarEtapasSchema>;

export interface EtapaFunil {
  id: string;
  nome: string;
  ordem: number;
}

/** Cliente como aparece num cartão do quadro. */
export interface ClienteNoFunil {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  origem: string | null;
  /** Quando entrou nesta etapa — o que revela oportunidade parada. */
  atualizadoEm: string;
}

/** Uma coluna do quadro: a etapa e quem está nela. */
export interface ColunaFunil {
  etapa: EtapaFunil;
  clientes: ClienteNoFunil[];
}

/**
 * O quadro inteiro.
 *
 * `foraDoFunil` são os clientes cadastrados que ainda não entraram em nenhuma
 * etapa. Aparecem separados para que dê para puxá-los ao quadro quando viram
 * oportunidade — sem isso, ficariam invisíveis.
 */
export interface QuadroFunil {
  colunas: ColunaFunil[];
  totalForaDoFunil: number;
}

/**
 * Há quantos dias o cliente está parado na etapa.
 *
 * É o número que transforma o funil de lista em ferramenta: mostra onde a
 * negociação empacou.
 */
export function diasNaEtapa(atualizadoEm: string): number {
  const MS_POR_DIA = 24 * 60 * 60 * 1000;
  const decorrido = Date.now() - new Date(atualizadoEm).getTime();

  return Math.max(0, Math.floor(decorrido / MS_POR_DIA));
}
