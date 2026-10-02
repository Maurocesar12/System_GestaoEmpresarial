import type { MovimentacaoConciliavel, TipoLancamento } from '@gestao/shared-types';
import { Prisma } from '../../generated/prisma/client';

/**
 * Conciliação bancária: do extrato cru às sugestões de vínculo.
 *
 * Tudo isto rodava no navegador — achar as colunas, entender datas e valores
 * do banco, pontuar cada conta em aberto. Agora é da API: a tela só lê o
 * arquivo e mostra o resultado. A conversão de valor aqui é a única do
 * sistema para extrato; a tela tinha a sua, diferente das demais.
 */

const COLUNAS_DATA = ['data', 'dt', 'date', 'lancamento', 'lançamento'];
const COLUNAS_DESCRICAO = [
  'descricao',
  'descrição',
  'historico',
  'histórico',
  'memo',
  'detalhe',
  'documento',
];
const COLUNAS_VALOR = ['valor', 'valor r$', 'amount', 'quantia', 'movimento', 'total'];

/** Pontuação mínima para sugerir um vínculo — abaixo disso, melhor não sugerir nada. */
const PONTUACAO_MINIMA = 55;

/** Quantas contas cada movimentação oferece, das mais prováveis para as menos. */
export const OPCOES_POR_MOVIMENTACAO = 20;

export interface MovimentacaoExtraida {
  id: string;
  data: string;
  descricao: string;
  tipo: TipoLancamento;
  /** Sempre positivo; o sentido está em `tipo`. */
  valor: Prisma.Decimal;
}

export interface ContaEmAberto {
  id: string;
  tipo: TipoLancamento;
  descricao: string;
  valor: Prisma.Decimal;
  /** Vencimento, ou a data do lançamento quando não há vencimento. */
  referencia: string;
}

export class ColunasNaoEncontradas extends Error {}

export function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function buscarIndice(cabecalhos: string[], opcoes: string[]): number {
  const normalizados = cabecalhos.map(normalizarTexto);
  return normalizados.findIndex((cabecalho) =>
    opcoes.some((opcao) => {
      const alvo = normalizarTexto(opcao);
      return cabecalho === alvo || cabecalho.includes(alvo);
    }),
  );
}

/**
 * `2026-09-10`, `10/09/2026` ou número de série do Excel, com ou sem hora no
 * fim. `null` quando não é data.
 *
 * Sem o `new Date(texto)` genérico que a tela usava como último recurso: ele
 * lê "10/09/2026" como 9 de outubro (formato americano) e trocaria dia e mês
 * de extrato brasileiro sem avisar.
 */
export function normalizarData(valor: string): string | null {
  const texto = valor.trim().split(/[ T]/)[0] ?? '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;

  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto);
  if (br) {
    const [, dia = '', mes = '', ano = ''] = br;
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  if (/^\d{5}$/.test(texto)) {
    return new Date(Date.UTC(1899, 11, Number(texto) - 1)).toISOString().slice(0, 10);
  }

  return null;
}

/**
 * Valor de extrato: `1.234,56`, `1,234.56`, `-150,00` ou `(150,00)`.
 *
 * Decimal, e não `Number`: a diferença entre extrato e conta é comparada ao
 * centavo, e ponto flutuante transformaria R$ 0,00 em R$ 0,0000001.
 */
export function valorDoExtrato(valor: string): Prisma.Decimal | null {
  const texto = valor.trim();
  if (!texto) return null;

  const negativo = texto.startsWith('-') || /^\(.*\)$/.test(texto);
  const limpo = texto.replace(/[^\d,.]/g, '');
  if (!limpo) return null;

  // O separador decimal é o último que aparece: "1.234,56" e "1,234.56".
  const virgulaDecimal = limpo.lastIndexOf(',') > limpo.lastIndexOf('.');
  const normalizado = virgulaDecimal
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo.replace(/,/g, '');

  if (!/^\d+(\.\d+)?$/.test(normalizado)) return null;

  const decimal = new Prisma.Decimal(normalizado).toDecimalPlaces(2);
  return negativo ? decimal.negated() : decimal;
}

/** Linhas do extrato como saíram do arquivo → movimentações. Linhas incompletas são descartadas. */
export function extrairMovimentacoes(
  cabecalhos: string[],
  linhas: string[][],
): { movimentacoes: MovimentacaoExtraida[]; ignoradas: number } {
  const indiceData = buscarIndice(cabecalhos, COLUNAS_DATA);
  const indiceDescricao = buscarIndice(cabecalhos, COLUNAS_DESCRICAO);
  const indiceValor = buscarIndice(cabecalhos, COLUNAS_VALOR);

  if (indiceData === -1 || indiceDescricao === -1 || indiceValor === -1) {
    throw new ColunasNaoEncontradas(
      'Não encontrei as colunas de data, descrição e valor no extrato. Ajuste o cabeçalho e tente novamente.',
    );
  }

  const movimentacoes: MovimentacaoExtraida[] = [];
  let ignoradas = 0;

  linhas.forEach((linha, indice) => {
    const data = normalizarData(linha[indiceData] ?? '');
    const descricao = (linha[indiceDescricao] ?? '').trim();
    const valor = valorDoExtrato(linha[indiceValor] ?? '');

    if (!data || !descricao || !valor || valor.isZero()) {
      ignoradas++;
      return;
    }

    movimentacoes.push({
      id: `${indice}`,
      data,
      descricao,
      tipo: valor.isNegative() ? 'saida' : 'entrada',
      valor: valor.abs(),
    });
  });

  return { movimentacoes, ignoradas };
}

function palavrasChave(texto: string): string[] {
  return normalizarTexto(texto)
    .split(/\s+/)
    .filter((palavra) => palavra.length >= 4);
}

function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(a) - Date.parse(b)) / (24 * 60 * 60 * 1000));
}

/**
 * Quanto a conta parece ser esta movimentação, de 0 a 100.
 *
 * Valor pesa mais (45), depois proximidade da data (30), depois palavras em
 * comum na descrição (25). A conta também tem de ser do mesmo sentido —
 * pagamento não concilia com recebimento.
 */
export function pontuar(movimentacao: MovimentacaoExtraida, conta: ContaEmAberto): number {
  const diferencaCentavos = movimentacao.valor.minus(conta.valor).abs().times(100).toNumber();
  const dias = Math.abs(diasEntre(movimentacao.data, conta.referencia));
  const palavrasBanco = new Set(palavrasChave(movimentacao.descricao));
  const emComum = palavrasChave(conta.descricao).filter((palavra) =>
    palavrasBanco.has(palavra),
  ).length;

  return (
    Math.max(0, 45 - diferencaCentavos / 100) +
    Math.max(0, 30 - dias * 4) +
    Math.min(25, emComum * 8)
  );
}

/** Para cada movimentação, as contas candidatas ordenadas e a sugestão, se houver. */
export function sugerirVinculos(
  movimentacoes: MovimentacaoExtraida[],
  contas: ContaEmAberto[],
): MovimentacaoConciliavel[] {
  return movimentacoes.map((movimentacao) => {
    const candidatas = contas
      .filter((conta) => conta.tipo === movimentacao.tipo)
      .map((conta) => ({ conta, pontuacao: pontuar(movimentacao, conta) }))
      .sort((a, b) => b.pontuacao - a.pontuacao)
      .slice(0, OPCOES_POR_MOVIMENTACAO);

    const melhor = candidatas[0];

    return {
      id: movimentacao.id,
      data: movimentacao.data,
      descricao: movimentacao.descricao,
      tipo: movimentacao.tipo,
      valor: movimentacao.valor.toFixed(2),
      contaSugeridaId: melhor && melhor.pontuacao >= PONTUACAO_MINIMA ? melhor.conta.id : null,
      opcoes: candidatas.map(({ conta }) => ({
        contaId: conta.id,
        descricao: conta.descricao,
        valor: conta.valor.toFixed(2),
        referencia: conta.referencia,
        // Positiva: o banco moveu mais do que a conta previa.
        diferenca: movimentacao.valor.minus(conta.valor).toFixed(2),
      })),
    };
  });
}
