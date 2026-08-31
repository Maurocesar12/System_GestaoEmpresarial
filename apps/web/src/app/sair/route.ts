import { redirect } from 'next/navigation';
import { limparSessao } from '@/lib/sessao';

/**
 * Encerra a sessão e devolve para a tela de entrada.
 *
 * Existe como rota, e não apenas como Server Action, porque precisa ser
 * alcançável por um simples redirecionamento do servidor. O caso concreto:
 * quando a API recusa o token (usuário removido, segredo trocado, sessão
 * revogada), o cookie ainda está no navegador. Redirecionar para `/entrar`
 * criaria um laço — o `proxy.ts` vê o cookie, considera que há sessão e manda
 * de volta para `/painel`, que recusa de novo.
 *
 * Só um Route Handler pode apagar cookies antes de renderizar; um Server
 * Component consegue lê-los, mas não escrevê-los. Por isso a saída passa por
 * aqui.
 */
export async function GET(): Promise<never> {
  await limparSessao();
  redirect('/entrar');
}
