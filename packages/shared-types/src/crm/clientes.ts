import { z } from 'zod';
import { opcional, textoOpcional } from '../common/opcional';
import { paginacaoQuerySchema } from '../common/paginacao';
import { LIMITE_IMPORTACAO } from './clientes-exibicao';

/**
 * Contrato de clientes (arquitetura §6, §7).
 *
 * O cliente é a entidade central do CRM: dele penduram atendimentos,
 * orçamentos, agendamentos e — no financeiro — os lançamentos que permitem
 * calcular quanto cada cliente deu de retorno.
 */

/**
 * Telefone brasileiro, aceito com ou sem máscara.
 *
 * A validação é deliberadamente frouxa: o objetivo é impedir lixo evidente, não
 * recusar o cadastro de quem digitou "(11) 91234-5678" em vez de "11912345678".
 * A normalização acontece antes, tirando tudo que não é dígito.
 */
export const telefoneSchema = z
  .string()
  .trim()
  .transform((valor) => valor.replace(/\D/g, ''))
  .refine((valor) => valor.length === 0 || (valor.length >= 10 && valor.length <= 11), {
    message: 'Telefone deve ter DDD e 8 ou 9 dígitos',
  });

/** CPF ou CNPJ, guardado apenas com os dígitos. */
const documentoSchema = z
  .string()
  .trim()
  .transform((valor) => valor.replace(/\D/g, ''))
  .refine((valor) => valor.length === 0 || valor.length === 11 || valor.length === 14, {
    message: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos)',
  });

export const clienteFormSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do cliente').max(120),
  email: opcional(z.string().trim().toLowerCase().pipe(z.email('E-mail inválido'))),
  telefone: opcional(telefoneSchema),
  documento: opcional(documentoSchema),
  observacoes: textoOpcional(2000),

  /** De onde veio o lead. Alimenta o relatório do módulo de marketing (§8.3). */
  origem: textoOpcional(60),
  utmSource: opcional(z.string().trim().max(120)),
  utmMedium: opcional(z.string().trim().max(120)),
  utmCampaign: opcional(z.string().trim().max(120)),
  camposPersonalizados: z.record(z.string(), z.string().max(500)).default({}),
  etiquetas: z.array(z.uuid()).max(50).default([]),
});

/**
 * O que sai da validação — já normalizado, com campos vazios como `null`.
 * É o formato que a API recebe e grava.
 */
export type ClienteFormInput = z.infer<typeof clienteFormSchema>;

/**
 * O que **entra** na validação, direto do formulário: tudo string, inclusive os
 * campos vazios.
 *
 * Os dois tipos existem porque o schema transforma os dados. Um `<input>` não
 * preenchido envia `""`, e o schema o converte para `null`. Sem separar
 * entrada de saída, o React Hook Form exigiria que o valor inicial de um campo
 * opcional já fosse `null` — o que deixaria o input descontrolado.
 */
export type ClienteFormEntrada = z.input<typeof clienteFormSchema>;

/** Filtros da listagem. */
export const clientesQuerySchema = paginacaoQuerySchema.extend({
  /** Busca por nome, e-mail ou telefone. */
  busca: z.string().trim().max(120).optional(),
  origem: z.string().trim().max(60).optional(),
});

export type ClientesQuery = z.infer<typeof clientesQuerySchema>;

/**
 * Cliente como o frontend o recebe.
 *
 * `etapaFunil` vem preenchido apenas na busca por id — é o que evita a ficha do
 * cliente precisar baixar o quadro inteiro só para descobrir em qual coluna ele
 * está. Nas listagens, onde o dado não é usado, ele fica ausente.
 */
export interface Cliente {
  /** Posição no funil. Só vem preenchido em `GET /clientes/:id`. */
  etapaFunil?: { id: string; nome: string } | null;
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  documento: string | null;
  observacoes: string | null;
  origem: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  camposPersonalizados: Record<string, string>;
  etiquetas: string[];
  /** Quando os dados pessoais foram eliminados a pedido do titular. */
  anonimizadoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export const importacaoClientesSchema = z.object({
  clientes: z
    .array(clienteFormSchema)
    .min(1, 'Envie ao menos um cliente')
    .max(LIMITE_IMPORTACAO, `Envie no máximo ${LIMITE_IMPORTACAO} clientes por vez`),
});

export type ImportacaoClientesInput = z.infer<typeof importacaoClientesSchema>;

/**
 * Conferência da planilha antes de importar: as linhas como saíram do arquivo,
 * sem nenhuma validação feita na tela.
 *
 * Cada linha é um objeto qualquer de propósito — validar é justamente o
 * trabalho da API, e uma linha malformada precisa chegar até ela para voltar
 * com o motivo em vez de derrubar a requisição inteira.
 */
/**
 * Uma célula como sai da planilha. "Objeto qualquer" não quer dizer qualquer
 * coisa: objeto aninhado ou texto de megabytes não sai de planilha nenhuma, e
 * aceitar isso só servia para quem quisesse pesar a API.
 */
const celulaImportacaoSchema = z.union([
  z.string().max(2000, 'Célula com texto longo demais'),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const conferenciaImportacaoClientesSchema = z.object({
  clientes: z
    .array(
      z
        .record(z.string().max(100), celulaImportacaoSchema)
        .refine((linha) => Object.keys(linha).length <= 60, 'Linha com colunas demais'),
    )
    .min(1, 'Envie ao menos uma linha')
    .max(LIMITE_IMPORTACAO, `Envie no máximo ${LIMITE_IMPORTACAO} linhas por vez`),
});

export type ConferenciaImportacaoClientesInput = z.infer<
  typeof conferenciaImportacaoClientesSchema
>;

/** Uma linha conferida pela API, na mesma posição em que foi enviada. */
export interface LinhaClienteConferida {
  valida: boolean;
  /** Mensagens legíveis, com o nome do campo quando não é o nome do cliente. */
  erros: string[];
  /** Os dados já normalizados, prontos para `/clientes/importar`. `null` se inválida. */
  dados: ClienteFormInput | null;
}

export interface ConferenciaImportacaoClientes {
  linhas: LinhaClienteConferida[];
}

/**
 * Por que uma linha não virou cliente.
 *
 * Importação silenciosa é pior do que importação que falha: o usuário acha que
 * subiu 300 clientes e descobre semanas depois que 40 ficaram de fora. Cada
 * linha ignorada volta com o motivo, e a tela mostra todos.
 */
export const MOTIVOS_IGNORADO = [
  'documento_repetido',
  'email_repetido',
  'repetido_no_arquivo',
] as const;

export const motivoIgnoradoSchema = z.enum(MOTIVOS_IGNORADO);
export type MotivoIgnorado = z.infer<typeof motivoIgnoradoSchema>;

export interface ClienteIgnorado {
  /** Posição dentro do lote enviado, começando em zero. */
  indice: number;
  nome: string;
  motivo: MotivoIgnorado;
}

export interface ResultadoImportacao {
  criados: number;
  ignorados: ClienteIgnorado[];
}
