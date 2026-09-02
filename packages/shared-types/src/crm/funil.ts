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
 * - **Movimentação automática pelos marcos.** Emitir um orçamento move o
 *   cliente para a etapa marcada como `orcamento_enviado`; aprovar move para a
 *   marcada como `fechado`. A automação segue o **marco**, e não o nome da
 *   etapa — assim renomear "Proposta" para "Orçamento enviado" não quebra nada.
 *   Recusar não move ninguém: a negociação pode continuar, e tirar a pessoa do
 *   lugar esconderia justamente o que precisa de atenção. Empresa sem etapa
 *   marcada segue funcionando; a automação é conveniência, não requisito.
 *
 * - **Cliente novo entra no funil sozinho**, na primeira etapa. O cadastro é o
 *   início da relação comercial, e um funil que só recebe quem alguém lembrou
 *   de arrastar mostra menos do que a realidade.
 *
 * Nenhuma dessas regras está gravada em pedra — todas são fáceis de mudar, e é
 * por isso que estão documentadas em vez de espalhadas pelo código.
 */

/**
 * Dias parado numa etapa a partir do qual a negociação merece atenção.
 *
 * Regra de negócio, e não detalhe de tela: o painel inicial e o quadro do funil
 * precisam usar o mesmo corte, senão o mesmo cliente aparece alertado num lugar
 * e normal no outro.
 */
export const DIAS_PARA_ALERTA = 7;

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

/**
 * A proposta em jogo numa negociação.
 *
 * É o orçamento em aberto mais recente do cliente. Se houver mais de um, o
 * mais recente é o que vale — os anteriores continuam na ficha do cliente.
 */
export interface OrcamentoDoCartao {
  id: string;
  /** String decimal, como todo valor monetário do sistema. */
  valor: string;
  servicoNome: string | null;
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
  /**
   * Proposta em aberto, quando existe.
   *
   * É o que transforma o quadro de lista de nomes em visão de negócio: dá para
   * ver quanto vale cada negociação sem abrir a ficha de ninguém.
   */
  orcamentoAberto: OrcamentoDoCartao | null;
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
