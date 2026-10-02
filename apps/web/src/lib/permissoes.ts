import type { Permissao } from '@gestao/shared-types';

/**
 * O usuário logado tem esta permissão?
 *
 * Só lê a lista que a API calculou no login (`permissoes`, já efetiva: o
 * padrão do papel com as personalizações aplicadas). A tela não conhece a
 * tabela de papéis nem decide nada — usa isto só para esconder botões que a
 * API recusaria de qualquer forma. Sem lista, a resposta é não.
 */
export function pode(
  usuario: { permissoes?: readonly Permissao[] } | undefined,
  permissao: Permissao,
): boolean {
  return usuario?.permissoes?.includes(permissao) ?? false;
}
