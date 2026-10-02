'use server';

import { apiFetch } from '@/lib/api';
import { traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';

/** Pede o link (com `email`) ou define a nova senha (com `token` e `senha`). A API valida. */
export async function recuperarSenha(dados: {
  email?: string;
  token?: string;
  senha?: string;
}): Promise<ResultadoAcao> {
  const redefinir = dados.token !== undefined;
  const corpo = redefinir ? { token: dados.token, senha: dados.senha } : { email: dados.email };
  try {
    await apiFetch<void>(`/auth/${redefinir ? 'redefinir-senha' : 'recuperar-senha'}`, {
      method: 'POST',
      body: JSON.stringify(corpo),
    });
    return {};
  } catch (erro) {
    return traduzirErroAcao(erro);
  }
}
