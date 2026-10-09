import type { NaturezaLancamento, TipoCusto, TipoLancamento } from '../enums';

/** Valores de exibição de `lancamentos`, sem Zod: o que a tela importa não carrega os schemas. */

export const MAX_ANEXOS_LANCAMENTO = 5;

/**
 * O que cada classificação significa, em uma linha.
 *
 * Fica ao lado do rótulo porque "fixo" e "variável" são termos de contabilidade
 * que o dono de PME não usa no dia a dia — e escolher errado aqui distorce o
 * custo operacional e a margem, sem nenhum aviso de que houve erro.
 */
export const EXPLICACAO_TIPO_CUSTO: Record<TipoCusto, string> = {
  fixo: 'Sai todo mês no mesmo valor, independente do movimento, como aluguel, internet e contador.',
  variavel:
    'Acompanha o movimento: quanto mais serviço, maior a conta, como material e combustível.',
  receita: 'Dinheiro entrando, como venda de serviço, mensalidade ou produto.',
};

export const ROTULO_TIPO_CUSTO: Record<TipoCusto, string> = {
  fixo: 'Custo fixo',
  variavel: 'Custo variável',
  receita: 'Receita',
};

export const ROTULO_TIPO_LANCAMENTO: Record<TipoLancamento, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
};

/**
 * Em quantas parcelas um lançamento pode ser dividido.
 *
 * Vinte e quatro cobre o parcelamento mais longo que PME de serviço pratica sem
 * virar financiamento. O limite existe também como proteção: um `parcelas`
 * absurdo criaria milhares de linhas numa transação só.
 */
export const MAX_PARCELAS = 24;

export const ROTULO_NATUREZA: Record<NaturezaLancamento, string> = {
  empresa: 'Empresa',
  pessoal: 'Pessoal',
};

export const MAX_BYTES_ANEXO_LANCAMENTO = 2 * 1024 * 1024;

/**
 * Teto do corpo da requisição de um lançamento, em bytes.
 *
 * O anexo viaja embutido no JSON, em base64 — que cresce cerca de 4/3 sobre o
 * arquivo original. Cinco anexos de 2 MB chegam perto de 14 MB de texto, e
 * tanto o Next quanto o Nest recusam corpos grandes por padrão (1 MB e 100 kB,
 * respectivamente). Sem alinhar os dois com este número, anexar qualquer coisa
 * além de um arquivo minúsculo falha — e falha tarde, no envio do formulário,
 * depois de a pessoa ter preenchido tudo.
 *
 * O valor é calculado a partir dos limites acima, e não digitado: mudar o
 * tamanho do anexo ou a quantidade permitida acerta o teto sozinho.
 */
export const MAX_BYTES_CORPO_LANCAMENTO =
  Math.ceil((MAX_ANEXOS_LANCAMENTO * MAX_BYTES_ANEXO_LANCAMENTO * 4) / 3) + 512 * 1024;

export const MIME_TYPES_ANEXO_LANCAMENTO = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;
