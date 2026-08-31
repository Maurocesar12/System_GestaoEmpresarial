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
 * **Não renova a sessão.** Quem faz isso é o middleware, que roda antes de
 * qualquer página e é o único lugar capaz de gravar cookies antes da
 * renderização — um Server Component consegue lê-los, mas não escrevê-los.
 *
 * Então, quando a API responde 401 aqui, a sessão realmente acabou: o
 * middleware já teve a chance de renovar e não conseguiu. O caminho é a tela de
 * entrada, e não uma mensagem de erro — sessão expirada é uma navegação a
 * fazer, não uma falha a exibir.
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
      // Para `/sair`, e não direto para `/entrar`. O cookie ainda existe neste
      // ponto — a API é que recusou o token (usuário removido, segredo trocado,
      // sessão revogada). Mandar para `/entrar` com o cookie no lugar faria o
      // `proxy.ts` devolver para `/painel`, que recusaria de novo: laço infinito.
      // A rota `/sair` apaga os cookies antes de encaminhar.
      redirect('/sair');
    }
    throw erro;
  }
}
