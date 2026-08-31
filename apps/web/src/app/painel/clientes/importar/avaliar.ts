import { clienteFormSchema, type ClienteFormInput } from '@gestao/shared-types';
import { linhaParaCliente, type CampoImportavel } from '@/lib/colunas-cliente';
import type { LinhaPlanilha } from '@/lib/planilha';

/**
 * Uma linha da planilha depois de validada.
 *
 * Guarda tanto o texto original (`bruto`, para a prévia mostrar o que a pessoa
 * escreveu) quanto o resultado normalizado (`dados`, que é o que vai para a
 * API) — exibir o valor já normalizado confundiria quem está conferindo, porque
 * o telefone apareceria sem a máscara que ele digitou.
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
 * Valida a planilha inteira com o **mesmo** schema do formulário de cadastro.
 *
 * Reaproveitar `clienteFormSchema` é o ponto: a importação aceita exatamente o
 * que o cadastro manual aceita, nem mais nem menos. Uma segunda validação
 * escrita só para cá acabaria divergindo — e a divergência apareceria como
 * cliente importado que o formulário recusaria.
 */
export function avaliarLinhas(
  linhas: LinhaPlanilha[],
  mapa: Record<CampoImportavel, number | null>,
): LinhaAvaliada[] {
  return linhas.map((linha, indice) => {
    const bruto = linhaParaCliente(linha, mapa);
    const resultado = clienteFormSchema.safeParse(bruto);

    // +2: a planilha começa em 1 e a primeira linha é o cabeçalho, então a
    // primeira linha de dados é a 2. É esse número que a pessoa vê no Excel.
    const numeroNaPlanilha = indice + 2;

    if (resultado.success) {
      return { numeroNaPlanilha, bruto, valida: true, erros: [], dados: resultado.data };
    }

    // Mensagens sem o caminho do campo quando ele já está óbvio na tela; com o
    // nome do campo quando não está.
    const erros = resultado.error.issues.map((problema) => {
      const campo = problema.path[0];
      return campo && campo !== 'nome' ? `${String(campo)}: ${problema.message}` : problema.message;
    });

    return { numeroNaPlanilha, bruto, valida: false, erros };
  });
}
