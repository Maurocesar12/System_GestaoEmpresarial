'use server';

import { redirect } from 'next/navigation';
import {
  cadastroSchema,
  loginSchema,
  type CadastroInput,
  type LoginInput,
  type SessaoResponse,
} from '@gestao/shared-types';
import { apiFetch, ApiRequestError } from '@/lib/api';
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

/** O que a tela recebe de volta quando algo dá errado. */
export interface ResultadoAcao {
  erro?: string;
  /** Erros por campo, para destacar o input correspondente. */
  campos?: Record<string, string[]>;
}

export async function entrar(dados: LoginInput): Promise<ResultadoAcao> {
  // Valida no servidor também, e não só no formulário: validação de cliente é
  // conveniência para quem digita, nunca uma garantia.
  const validacao = loginSchema.safeParse(dados);

  if (!validacao.success) {
    return { erro: 'Confira os dados informados.', campos: agruparErros(validacao.error) };
  }

  try {
    const sessao = await apiFetch<SessaoResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(validacao.data),
    });

    await gravarSessao(sessao);
  } catch (erro) {
    return traduzirErro(erro);
  }

  // `redirect` fica fora do try: por dentro ele funciona lançando uma exceção
  // especial, que o catch acima engoliria — e a navegação nunca aconteceria.
  redirect('/painel');
}

export async function cadastrar(dados: CadastroInput): Promise<ResultadoAcao> {
  const validacao = cadastroSchema.safeParse(dados);

  if (!validacao.success) {
    return { erro: 'Confira os dados informados.', campos: agruparErros(validacao.error) };
  }

  try {
    const sessao = await apiFetch<SessaoResponse>('/onboarding/cadastro', {
      method: 'POST',
      body: JSON.stringify(validacao.data),
    });

    await gravarSessao(sessao);
  } catch (erro) {
    return traduzirErro(erro);
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

/**
 * Converte o erro da API em algo que a tela sabe exibir.
 *
 * Mensagens vindas da API são escritas para o usuário final e podem ser
 * mostradas como estão. Qualquer outra coisa vira uma mensagem genérica — não
 * faz sentido exibir detalhe de rede para quem só quer entrar no sistema.
 */
function traduzirErro(erro: unknown): ResultadoAcao {
  if (erro instanceof ApiRequestError) {
    return { erro: erro.erro.mensagem, campos: erro.erro.detalhes };
  }

  return { erro: 'Não foi possível completar a ação. Tente novamente.' };
}

function agruparErros(erro: { issues: { path: PropertyKey[]; message: string }[] }) {
  const campos: Record<string, string[]> = {};

  for (const issue of erro.issues) {
    const campo = issue.path.join('.') || '_';
    (campos[campo] ??= []).push(issue.message);
  }

  return campos;
}
