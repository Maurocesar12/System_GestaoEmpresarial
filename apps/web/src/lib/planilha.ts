import Papa from 'papaparse';

/**
 * Leitura de planilha no navegador.
 *
 * O arquivo é lido aqui, e não enviado para a API, por três motivos: a pessoa
 * consegue conferir o conteúdo antes de gravar qualquer coisa, o servidor não
 * precisa lidar com upload nem com arquivo grande na memória, e um erro de
 * formato aparece na hora em vez de depois de uma viagem de rede.
 */

/** Linha da planilha já lida: cada célula como texto. */
export type LinhaPlanilha = string[];

export interface PlanilhaLida {
  cabecalhos: string[];
  linhas: LinhaPlanilha[];
  /** Nome da aba lida. Vazio em CSV, que não tem abas. */
  aba?: string;
  /** Quantas abas o arquivo tem. A tela avisa quando há mais de uma. */
  totalAbas?: number;
}

/** Extensões aceitas, para o `accept` do input e para a validação. */
export const EXTENSOES_ACEITAS = ['.csv', '.xlsx', '.xls'] as const;

export class ErroDePlanilha extends Error {}

/**
 * Decodifica o arquivo de texto respeitando a codificação.
 *
 * O Excel em português salva CSV em Windows-1252, não em UTF-8. Ler tudo como
 * UTF-8 transformaria "João" em "Jo?o" — e o cliente entraria no sistema com o
 * nome errado, o que só seria notado quando alguém fosse falar com ele.
 *
 * A tentativa é em UTF-8 com `fatal: true`: se houver um byte inválido, o
 * decodificador estoura e caímos para Windows-1252, que aceita qualquer byte.
 */
function decodificarTexto(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

function lerCsv(texto: string): PlanilhaLida {
  const resultado = Papa.parse<string[]>(texto, {
    // Sem `header: true`: o cabeçalho é tratado como uma linha comum para que a
    // tela mostre exatamente o que veio no arquivo, inclusive nomes repetidos
    // ou colunas sem título — que o modo `header` descartaria em silêncio.
    header: false,
    skipEmptyLines: 'greedy',
    // `delimiter` vazio liga a detecção automática. O Excel em português usa
    // ponto e vírgula, e o resto do mundo usa vírgula.
    delimiter: '',
  });

  const linhas = resultado.data.filter((linha) => linha.some((celula) => celula.trim() !== ''));

  if (linhas.length === 0) {
    throw new ErroDePlanilha('O arquivo está vazio.');
  }

  const [cabecalhos = [], ...corpo] = linhas;

  return { cabecalhos: cabecalhos.map((c) => c.trim()), linhas: corpo };
}

async function lerExcel(arquivo: File): Promise<PlanilhaLida> {
  // Importado sob demanda: a biblioteca só é baixada por quem realmente sobe um
  // arquivo do Excel, e não entra no pacote de quem apenas abre a tela.
  //
  // O caminho `/browser` é obrigatório — o pacote não tem entrada raiz, e
  // expõe uma versão por ambiente (navegador, Node, web worker).
  const { default: readXlsxFile } = await import('read-excel-file/browser');

  // A biblioteca devolve **todas** as abas do arquivo. Usamos a primeira, e a
  // tela informa qual foi quando houver mais de uma — ler em silêncio faria o
  // usuário achar que metade dos clientes sumiu.
  const abas = await readXlsxFile(arquivo);
  const primeira = abas[0];

  if (!primeira) {
    throw new ErroDePlanilha('O arquivo não tem nenhuma aba com dados.');
  }

  const comoTexto = primeira.data
    .map((linha) => linha.map((celula) => (celula === null ? '' : String(celula).trim())))
    .filter((linha) => linha.some((celula) => celula !== ''));

  if (comoTexto.length === 0) {
    throw new ErroDePlanilha(`A aba "${primeira.sheet}" está vazia.`);
  }

  const [cabecalhos = [], ...corpo] = comoTexto;

  return { cabecalhos, linhas: corpo, aba: primeira.sheet, totalAbas: abas.length };
}

/** Lê o arquivo escolhido, decidindo o formato pela extensão. */
export async function lerPlanilha(arquivo: File): Promise<PlanilhaLida> {
  const nome = arquivo.name.toLowerCase();

  if (nome.endsWith('.csv')) {
    return lerCsv(decodificarTexto(await arquivo.arrayBuffer()));
  }

  if (nome.endsWith('.xlsx') || nome.endsWith('.xls')) {
    return lerExcel(arquivo);
  }

  throw new ErroDePlanilha(
    `Formato não reconhecido. Envie um arquivo ${EXTENSOES_ACEITAS.join(', ')}.`,
  );
}
