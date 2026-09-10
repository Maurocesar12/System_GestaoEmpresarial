'use server';

import { z } from 'zod';
import { emailSchema, senhaSchema } from '@gestao/shared-types';
import { apiFetch } from '@/lib/api';
import { traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';

export async function recuperarSenha(dados: { email?: string; token?: string; senha?: string }): Promise<ResultadoAcao> {
  const redefinir = dados.token !== undefined;
  const schema = redefinir
    ? z.object({ token: z.string().min(1).max(2048), senha: senhaSchema })
    : z.object({ email: emailSchema });
  const resultado = schema.safeParse(dados);
  if (!resultado.success) return { erro: resultado.error.issues[0]?.message ?? 'Confira os campos.' };
  try {
    await apiFetch<void>(`/auth/${redefinir ? 'redefinir-senha' : 'recuperar-senha'}`, {
      method: 'POST', body: JSON.stringify(resultado.data),
    });
    return {};
  } catch (erro) { return traduzirErroAcao(erro); }
}
