import type { CanalLembrete } from '../enums';

/** Valores de exibição de `lembretes`, sem Zod: o que a tela importa não carrega os schemas. */

export const ROTULO_CANAL_LEMBRETE: Record<CanalLembrete, string> = {
  email: 'E-mail',
  whatsapp: 'WhatsApp',
};
