'use client';

import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { estilosBotao } from '@/components/ui/botao';

export function NavegacaoMobile({
  secoes,
}: {
  secoes: readonly { href: string; rotulo: string }[];
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function fechar(evento: KeyboardEvent) {
      if (evento.key === 'Escape' && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector('summary')?.focus();
      }
    }
    document.addEventListener('keydown', fechar);
    return () => document.removeEventListener('keydown', fechar);
  }, []);

  return (
    <details ref={ref} className="group lg:hidden">
      <summary
        aria-label="Menu de navegação"
        className="flex size-11 cursor-pointer list-none items-center justify-center rounded-md hover:bg-accent [&::-webkit-details-marker]:hidden"
      >
        <Menu aria-hidden className="size-5 group-open:hidden" />
        <X aria-hidden className="hidden size-5 group-open:block" />
      </summary>
      <nav
        aria-label="Navegação no celular"
        className="absolute inset-x-0 top-full border-b bg-background px-6 py-5 shadow-[var(--sombra-media)]"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('a') && ref.current) ref.current.open = false;
        }}
      >
        <div className="mx-auto grid max-w-6xl gap-1">
          {secoes.map((secao) => (
            <a
              className="rounded-md px-3 py-3 text-sm hover:bg-accent"
              key={secao.href}
              href={secao.href}
            >
              {secao.rotulo}
            </a>
          ))}
          <div className="mt-3 grid grid-cols-2 gap-3 border-t pt-4">
            <Link href="/entrar" className={estilosBotao({ variante: 'secundario' })}>
              Entrar
            </Link>
            <Link href="/cadastro" className={estilosBotao()}>
              Criar conta
            </Link>
          </div>
        </div>
      </nav>
    </details>
  );
}
