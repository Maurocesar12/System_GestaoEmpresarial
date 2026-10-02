import { z } from 'zod';
import type { TipoLancamento } from '../enums';

/**
 * Conciliação bancária.
 *
 * A tela lê o arquivo do banco e manda as células como estão. Achar as
 * colunas, entender datas e valores, buscar as contas em aberto e sugerir o
 * vínculo é trabalho da API — a tela não faz conta nem decide nada.
 */

/** Teto de linhas por análise: um extrato mensal de PME cabe com folga. */
export const LIMITE_LINHAS_EXTRATO = 1000;

export const analiseConciliacaoSchema = z.object({
  cabecalhos: z.array(z.string().max(200)).min(1).max(50),
  linhas: z
    .array(z.array(z.string().max(500)).max(50))
    .min(1, 'O extrato não tem linhas')
    .max(LIMITE_LINHAS_EXTRATO, `Envie no máximo ${LIMITE_LINHAS_EXTRATO} linhas por vez`),
});

export type AnaliseConciliacaoInput = z.infer<typeof analiseConciliacaoSchema>;

/** Uma conta em aberto que pode ser o par de uma movimentação. */
export interface OpcaoDeVinculo {
  contaId: string;
  descricao: string;
  valor: string;
  /** Vencimento da conta, ou a data dela quando não há vencimento. */
  referencia: string;
  /** Movimentação menos conta. "0.00" quando o valor bate. */
  diferenca: string;
}

export interface MovimentacaoConciliavel {
  /** Posição da linha no extrato enviado. */
  id: string;
  data: string;
  descricao: string;
  tipo: TipoLancamento;
  /** Sempre positivo; o sentido está em `tipo`. */
  valor: string;
  /** A conta mais provável, quando a semelhança é suficiente. */
  contaSugeridaId: string | null;
  /** As contas do mesmo sentido mais parecidas, da mais para a menos provável. */
  opcoes: OpcaoDeVinculo[];
}

export interface ConciliacaoAnalisada {
  movimentacoes: MovimentacaoConciliavel[];
  /** Linhas sem data, descrição ou valor reconhecível. */
  ignoradas: number;
  contasEmAberto: number;
}
