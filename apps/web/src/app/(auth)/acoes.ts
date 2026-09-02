'use server';

import { redirect } from 'next/navigation';
import {
  cadastroSchema,
  loginSchema,
  type CadastroInput,
  type LoginInput,
  type SessaoResponse,
} from '@gestao/shared-types';
import { erroDeValidacao, traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiFetch } from '@/lib/api';
import { gravarSessao, lerRefreshToken, limparSessao } from '@/lib/sessao';

/**
 * Ações de sessão, executadas no servidor.
 *
 * São Server Actions: o formulário do navegador as chama, mas o código roda no
 * servidor do Next. É o que permite gravar o cookie `httpOnly` — algo que o
 * JavaScript da página, por definição, não consegue fazer.
 *
 * O token nunca chega ao navegador em lugar nenhum: a API o devolve aqui, e
 * daqui ele vai direto para o cookie.
 */

export async function entrar(dados: LoginInput): Promise<ResultadoAcao> {
  // Valida no servidor também, e não só no formulário: validação de cliente é
  // conveniência para quem digita, nunca uma garantia.
  const validacao = loginSchema.safeParse(dados);

  if (!validacao.success) {
    return erroDeValidacao(validacao.error.issues);
  }

  try {
    const sessao = await apiFetch<SessaoResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(validacao.data),
    });

    await gravarSessao(sessao);
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  // `redirect` fica fora do try: por dentro ele funciona lançando uma exceção
  // especial, que o catch acima engoliria — e a navegação nunca aconteceria.
  redirect('/painel');
}

export async function cadastrar(dados: CadastroInput): Promise<ResultadoAcao> {
  const validacao = cadastroSchema.safeParse(dados);

  if (!validacao.success) {
    return erroDeValidacao(validacao.error.issues);
  }

  try {
    const sessao = await apiFetch<SessaoResponse>('/onboarding/cadastro', {
      method: 'POST',
      body: JSON.stringify(validacao.data),
    });

    await gravarSessao(sessao);
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  redirect('/painel');
}

export async function sair(): Promise<void> {
  const refreshToken = await lerRefreshToken();

  if (refreshToken) {
    try {
      await apiFetch<void>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Se a API não responder, seguimos e limpamos o cookie mesmo assim: para
      // quem clicou em "sair", o resultado esperado é sair.
    }
  }

  await limparSessao();
  redirect('/entrar');
}
