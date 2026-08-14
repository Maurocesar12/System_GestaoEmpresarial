/**
 * Formato de erro devolvido pela API.
 *
 * Um único formato para toda falha permite que o frontend trate erro em um
 * lugar só, em vez de adivinhar o shape a cada endpoint.
 */
export interface ApiError {
  /** Código estável, legível por máquina. Ex.: 'TENANT_SUSPENSO'. */
  codigo: string;
  /** Mensagem em pt-BR, segura para exibir ao usuário final. */
  mensagem: string;
  /** Erros de validação campo a campo, quando houver. */
  detalhes?: Record<string, string[]>;
  /** Correlaciona a resposta com a entrada de log no servidor. */
  requestId?: string;
}

/** Códigos de erro conhecidos. Estenda conforme os módulos entram. */
export const CODIGOS_ERRO = {
  VALIDACAO: 'VALIDACAO',
  NAO_AUTENTICADO: 'NAO_AUTENTICADO',
  SEM_PERMISSAO: 'SEM_PERMISSAO',
  NAO_ENCONTRADO: 'NAO_ENCONTRADO',
  CONFLITO: 'CONFLITO',
  LIMITE_PLANO_EXCEDIDO: 'LIMITE_PLANO_EXCEDIDO',
  TENANT_SUSPENSO: 'TENANT_SUSPENSO',
  MUITAS_REQUISICOES: 'MUITAS_REQUISICOES',
  ERRO_INTERNO: 'ERRO_INTERNO',
} as const;

export type CodigoErro = (typeof CODIGOS_ERRO)[keyof typeof CODIGOS_ERRO];
