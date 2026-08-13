import type { UsuarioAutenticado } from '@gestao/shared-types';
import { apiComSessao } from '@/lib/api-servidor';
import { sair } from '../(auth)/acoes';

/**
 * Layout da área autenticada.
 *
 * Busca o usuário no servidor a cada carregamento, em vez de guardá-lo no
 * navegador. É uma requisição a mais, e em troca não existe cópia de dados de
 * sessão fora do cookie — nada para ficar desatualizado quando o papel do
 * usuário mudar, nada para um script da página conseguir ler.
 */
export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const usuario = await apiComSessao<UsuarioAutenticado>('/auth/eu');

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight">{usuario.nomeEmpresa}</span>
            <span className="text-muted-foreground text-xs">
              {usuario.nome} · {usuario.papel}
            </span>
          </div>

          <form action={sair}>
            <button
              type="submit"
              className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
            >
              Sair
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
