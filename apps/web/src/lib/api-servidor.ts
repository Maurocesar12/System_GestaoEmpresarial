import 'server-only';
import { redirect } from 'next/navigation';
import { apiFetch, ApiRequestError } from './api';
import { lerAccessToken } from './sessao';

/**
 * Chama a API em nome do usuário logado.
 *
 * Lê o token do cookie `httpOnly` e o envia no cabeçalho `Authorization`. Só
 * funciona no servidor — é lá que o cookie é legível, e é justamente por isso
 * que ele é `httpOnly`.
 *
 * Quando a API responde 401, a sessão acabou: em vez de propagar o erro para a
 * tela, manda para o login. Uma sessão expirada não é falha a ser exibida, é
 * uma navegação a fazer.
 */
export async function apiComSessao<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const token = await lerAccessToken();

  if (!token) {
    redirect('/entrar');
  }

  try {
    return await apiFetch<T>(caminho, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
      // Dados de tenant nunca entram em cache compartilhado: o mesmo caminho
      // devolve conteúdo diferente para cada empresa.
      cache: 'no-store',
    });
  } catch (erro) {
    if (erro instanceof ApiRequestError && erro.status === 401) {
      redirect('/entrar');
    }
    throw erro;
  }
}
