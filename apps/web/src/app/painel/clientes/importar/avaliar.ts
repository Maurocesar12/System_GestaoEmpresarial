import { LIMITE_IMPORTACAO, type ClienteFormInput } from '@gestao/shared-types';
import { linhaParaCliente, type CampoImportavel } from '@/lib/colunas-cliente';
import type { LinhaPlanilha } from '@/lib/planilha';
import { conferirImportacao } from '../acoes';

/**
 * Uma linha da planilha depois de conferida pela API.
 *
 * Guarda tanto o texto original (`bruto`, para a prévia mostrar o que a pessoa
 * escreveu) quanto o resultado normalizado (`dados`, que é o que vai para a
 * importação) — exibir o valor já normalizado confundiria quem está
 * conferindo, porque o telefone apareceria sem a máscara que ele digitou.
 */
export interface LinhaAvaliada {
  /** Número da linha no arquivo, contando o cabeçalho. Começa em 2. */
  numeroNaPlanilha: number;
  bruto: Record<CampoImportavel, string>;
  valida: boolean;
  /** Mensagens de validação, já legíveis. Vazio quando a linha está boa. */
  erros: string[];
  /** Preenchido apenas quando `valida` é verdadeiro. */
  dados?: ClienteFormInput;
}

/**
 * Manda a planilha para a API conferir e junta as respostas.
 *
 * Aqui só se lê o arquivo: cada linha vira o objeto de colunas que o
 * mapeamento escolheu, sem nenhuma regra. Quem diz se a linha é válida é a
 * API (`/clientes/importar/conferir`), com o mesmo schema do cadastro e da
 * importação. Em lotes, no mesmo teto da importação.
 */
export async function avaliarLinhas(
  linhas: LinhaPlanilha[],
  mapa: Record<CampoImportavel, number | null>,
): Promise<{ avaliadas?: LinhaAvaliada[]; erro?: string }> {
  const brutas = linhas.map((linha) => linhaParaCliente(linha, mapa));
  const avaliadas: LinhaAvaliada[] = [];

  for (let inicio = 0; inicio < brutas.length; inicio += LIMITE_IMPORTACAO) {
    const lote = brutas.slice(inicio, inicio + LIMITE_IMPORTACAO);
    const resposta = await conferirImportacao(lote);

    if (resposta.erro || !resposta.linhas) {
      return { erro: resposta.erro ?? 'Não foi possível conferir a planilha.' };
    }

    resposta.linhas.forEach((conferida, posicao) => {
      const indice = inicio + posicao;
      avaliadas.push({
        // +2: a planilha começa em 1 e a primeira linha é o cabeçalho, então a
        // primeira linha de dados é a 2. É esse número que a pessoa vê no Excel.
        numeroNaPlanilha: indice + 2,
        bruto: brutas[indice]!,
        valida: conferida.valida,
        erros: conferida.erros,
        dados: conferida.dados ?? undefined,
      });
    });
  }

  return { avaliadas };
}
