import { SetMetadata } from '@nestjs/common';
import type { PapelUsuario } from '@gestao/shared-types';

export const CHAVE_PAPEIS = 'papeis_necessarios';

/**
 * Restringe a rota a determinados papéis, independente das permissões.
 *
 * Permissão é o que um administrador pode conceder a qualquer funcionário;
 * papel é quem a pessoa é dentro da empresa. Ações que nem por concessão devem
 * sair da mão do dono — apagar o histórico de auditoria, por exemplo — se
 * declaram aqui, e não com {@link Permissoes}: uma permissão marcada por
 * engano na tela de equipe não abre a porta.
 *
 * @example
 * ```ts
 * @Delete(':id')
 * @Papeis('admin')
 * remover(@Param('id') id: string) {}
 * ```
 */
export const Papeis = (...papeis: PapelUsuario[]) => SetMetadata(CHAVE_PAPEIS, papeis);
