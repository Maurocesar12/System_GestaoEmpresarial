/**
 * De coluna da planilha para campo do cliente.
 *
 * O objetivo é que ninguém precise reformatar a planilha antes de subir. As
 * pessoas exportam do sistema antigo, do Excel do contador ou da agenda do
 * celular, e cada um nomeia as colunas de um jeito. O reconhecimento cobre os
 * apelidos mais comuns, e o que ele errar a pessoa corrige na tela — o palpite
 * é um atalho, nunca uma imposição.
 */

/** Campos que a importação sabe preencher. */
export const CAMPOS_IMPORTAVEIS = [
  'nome',
  'telefone',
  'email',
  'documento',
  'origem',
  'observacoes',
] as const;

export type CampoImportavel = (typeof CAMPOS_IMPORTAVEIS)[number];

export const ROTULO_CAMPO: Record<CampoImportavel, string> = {
  nome: 'Nome',
  telefone: 'Telefone',
  email: 'E-mail',
  documento: 'CPF ou CNPJ',
  origem: 'Origem',
  observacoes: 'Observações',
};

/** O único campo sem o qual não dá para criar o cliente. */
export const CAMPO_OBRIGATORIO: CampoImportavel = 'nome';

/**
 * Apelidos reconhecidos, já normalizados (sem acento, minúsculos).
 *
 * A ordem importa dentro de cada lista apenas para leitura; a comparação é por
 * igualdade exata depois da normalização, e não por "contém" — `contains`
 * casaria "nome do vendedor" com `nome`, trazendo a coluna errada.
 */
const APELIDOS: Record<CampoImportavel, readonly string[]> = {
  nome: ['nome', 'cliente', 'nome do cliente', 'razao social', 'nome completo', 'name'],
  telefone: ['telefone', 'celular', 'fone', 'whatsapp', 'contato', 'telefone 1', 'phone'],
  email: ['email', 'e mail', 'e-mail', 'correio eletronico', 'mail'],
  documento: ['documento', 'cpf', 'cnpj', 'cpf cnpj', 'cpf/cnpj', 'doc'],
  origem: ['origem', 'como conheceu', 'fonte', 'canal'],
  observacoes: ['observacoes', 'observacao', 'obs', 'anotacoes', 'notas', 'comentarios'],
};

/**
 * Tira acento, pontuação e caixa para comparar.
 *
 * `NFD` separa a letra do acento, e a faixa `̀-ͯ` remove só os
 * acentos — assim "Observações" e "observacoes" viram a mesma coisa.
 */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Palpite de qual coluna da planilha alimenta cada campo.
 *
 * Devolve o índice da coluna, ou `null` quando não houver correspondência. Uma
 * mesma coluna nunca é usada para dois campos: a primeira que casar vence, e as
 * demais seguem procurando.
 */
export function detectarColunas(cabecalhos: string[]): Record<CampoImportavel, number | null> {
  const normalizados = cabecalhos.map(normalizar);
  const usados = new Set<number>();

  const mapa = {} as Record<CampoImportavel, number | null>;

  for (const campo of CAMPOS_IMPORTAVEIS) {
    const indice = normalizados.findIndex(
      (cabecalho, posicao) =>
        !usados.has(posicao) && cabecalho !== '' && APELIDOS[campo].includes(cabecalho),
    );

    if (indice === -1) {
      mapa[campo] = null;
      continue;
    }

    usados.add(indice);
    mapa[campo] = indice;
  }

  return mapa;
}

/**
 * Monta o objeto do formulário a partir de uma linha.
 *
 * Devolve tudo como string, no mesmo formato que o formulário de cadastro
 * produz — é o que permite validar com o **mesmo** `clienteFormSchema`, em vez
 * de escrever uma segunda validação só para a importação, que um dia
 * divergiria da primeira.
 */
export function linhaParaCliente(
  linha: string[],
  mapa: Record<CampoImportavel, number | null>,
): Record<CampoImportavel, string> {
  const cliente = {} as Record<CampoImportavel, string>;

  for (const campo of CAMPOS_IMPORTAVEIS) {
    const indice = mapa[campo];
    cliente[campo] = indice === null ? '' : (linha[indice] ?? '').trim();
  }

  return cliente;
}
