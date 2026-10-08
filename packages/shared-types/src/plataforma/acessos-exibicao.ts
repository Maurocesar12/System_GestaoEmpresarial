import type { PapelUsuario } from '../enums';

/** Valores de exibição de `acessos`, sem Zod: o que a tela importa não carrega os schemas. */

export const ROTULO_PAPEL: Record<PapelUsuario, string> = {
  admin: 'Administrador',
  financeiro: 'Financeiro',
  atendente: 'Atendente',
  tecnico: 'Técnico',
};
