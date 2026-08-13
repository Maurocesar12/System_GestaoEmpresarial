import Link from 'next/link';

/**
 * Layout das telas de entrada e cadastro.
 *
 * Sem menu nem navegação: quem está aqui ainda não tem sessão, e qualquer link
 * a mais é uma chance de sair do caminho antes de concluir.
 */
export default function LayoutAutenticacao({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Gestão Empresarial
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
