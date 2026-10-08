import { z } from 'zod';
import {
  naturezaLancamentoSchema,
  tipoLancamentoSchema,
  type NaturezaLancamento,
  type TipoLancamento,
} from '../enums';
import { dinheiroDigitadoSchema } from '../common/dinheiro';
import { opcional } from '../common/opcional';
import { PERIODICIDADES } from './recorrencia-exibicao';

/**
 * Lançamento recorrente: o molde de uma despesa ou receita que se repete.
 *
 * ## O problema que resolve
 *
 * Aluguel, salário, internet, contador, mensalidade de software. Sem
 * recorrência, tudo isso é digitado de novo todo mês — e é a primeira coisa que
 * faz alguém abandonar um sistema financeiro e voltar para a planilha.
 *
 * ## Molde, não lançamento
 *
 * Uma despesa que repete não tem fim conhecido, então não há como criar todas
 * as ocorrências de uma vez. O molde guarda o que se repete e a data da
 * próxima; um agendador diário transforma o molde em lançamento de verdade
 * quando a data se aproxima.
 *
 * Isso significa que o lançamento gerado é **comum**: vence, atrasa, recebe
 * baixa e entra no fluxo de caixa como qualquer outro. Nenhuma tela precisou
 * aprender um tipo novo.
 */

export const periodicidadeSchema = z.enum(PERIODICIDADES);
export type Periodicidade = z.infer<typeof periodicidadeSchema>;

/**
 * Quantos dias antes do vencimento a ocorrência é criada.
 *
 * Não é na data do vencimento: uma conta que aparece no dia em que vence chega
 * tarde para quem precisa se organizar. Trinta dias garantem que a próxima
 * ocorrência de uma recorrência mensal esteja sempre visível em "contas a
 * pagar", com tempo de reagir.
 *
 * A política de RLS da varredura usa uma folga maior (45 dias) de propósito:
 * ela é uma cerca, não a regra. Assim, mudar este número não exige migration.
 */
export const DIAS_DE_ANTECEDENCIA_RECORRENCIA = 30;

export const recorrenciaFormSchema = z.object({
  tipo: tipoLancamentoSchema,
  natureza: naturezaLancamentoSchema.default('empresa'),

  descricao: z.string().trim().min(2, 'Descreva o lançamento').max(180),
  valor: dinheiroDigitadoSchema,

  periodicidade: periodicidadeSchema,

  /**
   * Vencimento da primeira ocorrência, `AAAA-MM-DD`.
   *
   * É a âncora do ciclo: o dia daqui é o dia de vencimento de todas as
   * seguintes. Escolher 31 significa "último dia do mês" nos meses curtos.
   */
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),

  /** Vazio significa repetir até alguém desligar. */
  fim: opcional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')),

  categoriaId: opcional(z.uuid()),
  servicoId: opcional(z.uuid()),
  clienteId: opcional(z.uuid()),
});

export type RecorrenciaFormInput = z.infer<typeof recorrenciaFormSchema>;
export type RecorrenciaFormEntrada = z.input<typeof recorrenciaFormSchema>;

export interface LancamentoRecorrente {
  id: string;
  tipo: TipoLancamento;
  natureza: NaturezaLancamento;
  descricao: string;
  /** String decimal — nunca `number`, para não perder centavos. */
  valor: string;
  periodicidade: Periodicidade;
  /** A âncora do ciclo. Nunca muda. */
  inicio: string;
  /** Quando a próxima ocorrência vence. Derivada de `inicio` + `ocorrenciasGeradas`. */
  proximaEm: string;
  fim: string | null;
  ativo: boolean;

  categoriaId: string | null;
  categoriaNome: string | null;
  servicoId: string | null;
  servicoNome: string | null;
  clienteId: string | null;
  clienteNome: string | null;

  /** Quantas ocorrências este molde já gerou. Zero até a primeira geração. */
  ocorrenciasGeradas: number;

  criadoEm: string;
}

/**
 * O compromisso mensal, somado pela API.
 *
 * Só as recorrências **mensais e ativas** entram: somar uma anual junto
 * multiplicaria por doze o peso de um seguro no mês — e o número existe
 * justamente para dizer quanto sai por mês.
 */
export interface ResumoRecorrencias {
  saidaMensal: string;
  entradaMensal: string;
  ativas: number;
  pausadas: number;
}

/**
 * Onde cai a ocorrência número `indice` de um ciclo, contando do zero.
 *
 * Vive no contrato compartilhado porque a API usa para gerar a ocorrência e a
 * tela usa para mostrar quando ela cai — as duas precisam chegar ao mesmo dia.
 *
 * ## Por que recebe o início, e não a data anterior
 *
 * Esta é a armadilha da recorrência mensal, e ela só aparece meses depois.
 *
 * Um aluguel que vence dia 31 precisa encurtar ao passar por fevereiro: 31/01
 * vira 28/02. Se a ocorrência seguinte for calculada a partir de **28/02**, ela
 * dá 28/03 — e o vencimento nunca mais volta ao dia 31. Depois de um ano, uma
 * conta do fim do mês está sendo cobrada no dia 28, sem ninguém ter mudado nada.
 *
 * Calcular sempre a partir do início imutável elimina a deriva: o encurtamento
 * vale só para o mês curto, e 31/03 volta a ser 31. É por isso que o cursor da
 * recorrência é um **contador de ocorrências**, e não a última data gerada.
 *
 * @param inicio `AAAA-MM-DD` da primeira ocorrência. Nunca muda.
 * @param indice 0 é a primeira ocorrência, 1 a seguinte, e assim por diante.
 */
export function ocorrenciaDoCiclo(
  inicio: string,
  periodicidade: Periodicidade,
  indice: number,
): string {
  const [ano, mes, dia] = inicio.split('-').map(Number);

  if (periodicidade === 'semanal') {
    // Sete dias corridos por ocorrência: `Date.UTC` vira mês e ano sozinho.
    return new Date(Date.UTC(ano!, mes! - 1, dia! + 7 * indice)).toISOString().slice(0, 10);
  }

  const mesesPorCiclo = periodicidade === 'mensal' ? 1 : periodicidade === 'trimestral' ? 3 : 12;
  const mesAlvo = mes! - 1 + mesesPorCiclo * indice;

  // Dia zero do mês seguinte ao alvo é o último dia do mês alvo — acerta
  // fevereiro bissexto sem tabela de dias.
  const ultimoDiaDoAlvo = new Date(Date.UTC(ano!, mesAlvo + 1, 0)).getUTCDate();

  return new Date(Date.UTC(ano!, mesAlvo, Math.min(dia!, ultimoDiaDoAlvo)))
    .toISOString()
    .slice(0, 10);
}
