import type { MotivoIgnorado } from './clientes';

/** Valores de exibição de `clientes`, sem Zod: o que a tela importa não carrega os schemas. */

/**
 * Teto de clientes por requisição.
 *
 * Não é um limite do produto: a tela quebra planilhas maiores em lotes e envia
 * um atrás do outro. O teto existe para que uma requisição isolada tenha
 * tamanho previsível — corpo de JSON, tempo de transação e memória do servidor
 * crescem todos com este número.
 */
export const LIMITE_IMPORTACAO = 500;

export const ROTULO_MOTIVO_IGNORADO: Record<MotivoIgnorado, string> = {
  documento_repetido: 'Já existe um cliente com este CPF/CNPJ',
  email_repetido: 'Já existe um cliente com este e-mail',
  repetido_no_arquivo: 'Repetido dentro da própria planilha',
};

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
