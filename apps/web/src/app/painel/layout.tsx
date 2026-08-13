import type { PapelUsuario, UsuarioAutenticado } from '@gestao/shared-types';
import Link from 'next/link';
import { apiComSessao } from '@/lib/api-servidor';
import { sair } from '../(auth)/acoes';

/**
 * Itens de menu, filtrados por papel (arquitetura §9.5).
 *
 * A mesma regra vale no backend, nos guards das rotas. Esconder um item aqui é
 * cortesia com o usuário — não mostrar o que ele não pode usar; a proteção de
 * verdade é a da API, que recusa a requisição mesmo se alguém digitar a URL.
 */
interface ItemMenu {
  href: string;
  rotulo: string;
  /** `null` significa visível para qualquer papel. */
  papeis: readonly PapelUsuario[] | null;
}

const MENU: readonly ItemMenu[] = [
  { href: '/painel', rotulo: 'Início', papeis: null },
  { href: '/painel/clientes', rotulo: 'Clientes', papeis: ['admin', 'atendente', 'tecnico'] },
];

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

  const itensVisiveis = MENU.filter(
    (item) => item.papeis === null || item.papeis.includes(usuario.papel),
  );

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

        <nav className="mx-auto flex max-w-5xl gap-1 px-6" aria-label="Seções do sistema">
          {itensVisiveis.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hover:text-foreground text-muted-foreground border-b-2 border-transparent px-3 py-2 text-sm transition-colors"
            >
              {item.rotulo}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
