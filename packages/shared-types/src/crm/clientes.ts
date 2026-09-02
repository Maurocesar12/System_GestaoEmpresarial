import { z } from 'zod';
import { opcional, textoOpcional } from '../common/opcional';
import { paginacaoQuerySchema } from '../common/paginacao';

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
const telefoneSchema = z
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
  criadoEm: string;
  atualizadoEm: string;
}

/** Formata telefone guardado só com dígitos para exibição. */
export function formatarTelefone(telefone: string | null): string {
  if (!telefone) return '';

  if (telefone.length === 11) {
    return `(${telefone.slice(0, 2)}) ${telefone.slice(2, 7)}-${telefone.slice(7)}`;
  }

  if (telefone.length === 10) {
    return `(${telefone.slice(0, 2)}) ${telefone.slice(2, 6)}-${telefone.slice(6)}`;
  }

  return telefone;
}

/** Formata CPF ou CNPJ guardado só com dígitos para exibição. */
export function formatarDocumento(documento: string | null): string {
  if (!documento) return '';

  if (documento.length === 11) {
    return documento.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  if (documento.length === 14) {
    return documento.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }

  return documento;
}

// --- Importação em massa ---------------------------------------------------

/**
 * Teto de clientes por requisição.
 *
 * Não é um limite do produto: a tela quebra planilhas maiores em lotes e envia
 * um atrás do outro. O teto existe para que uma requisição isolada tenha
 * tamanho previsível — corpo de JSON, tempo de transação e memória do servidor
 * crescem todos com este número.
 */
export const LIMITE_IMPORTACAO = 500;

export const importacaoClientesSchema = z.object({
  clientes: z
    .array(clienteFormSchema)
    .min(1, 'Envie ao menos um cliente')
    .max(LIMITE_IMPORTACAO, `Envie no máximo ${LIMITE_IMPORTACAO} clientes por vez`),
});

export type ImportacaoClientesInput = z.infer<typeof importacaoClientesSchema>;

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

export const ROTULO_MOTIVO_IGNORADO: Record<MotivoIgnorado, string> = {
  documento_repetido: 'Já existe um cliente com este CPF/CNPJ',
  email_repetido: 'Já existe um cliente com este e-mail',
  repetido_no_arquivo: 'Repetido dentro da própria planilha',
};

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
