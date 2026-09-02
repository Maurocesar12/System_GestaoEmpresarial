'use client';

import type { UsuarioAutenticado } from '@gestao/shared-types';
import { LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { AlternadorTema } from '@/components/ui/tema';
import { cn } from '@/lib/utils';
import { hrefAtivo, menuDoPapel } from './menu';

/**
 * Estrutura da área autenticada.
 *
 * A navegação saiu do topo e foi para a lateral. O motivo não é estético: são
 * oito destinos, e no topo eles competem por largura com o nome da empresa,
 * espremendo tudo. Na lateral cabem agrupados e com ícone, e a área útil ganha
 * a largura inteira da tela — que é o que uma tabela de clientes ou um quadro
 * de funil precisam.
 *
 * Em telas estreitas a lateral vira uma gaveta, porque 240px fixos comeriam
 * dois terços de um celular.
 */
interface Props {
  usuario: UsuarioAutenticado;
  /** Server Action de logout, recebida do layout (componente de servidor). */
  aoSair: () => Promise<void>;
  children: ReactNode;
}

const ROTULO_PAPEL: Record<UsuarioAutenticado['papel'], string> = {
  admin: 'Administrador',
  financeiro: 'Financeiro',
  atendente: 'Atendente',
  tecnico: 'Técnico',
};

export function ShellPainel({ usuario, aoSair, children }: Props) {
  const caminho = usePathname();
  const [gavetaAberta, setGavetaAberta] = useState(false);

  const grupos = menuDoPapel(usuario.papel);
  const ativo = hrefAtivo(grupos, caminho);

  // Esc fecha, como em qualquer sobreposição do sistema operacional.
  useEffect(() => {
    if (!gavetaAberta) return;

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setGavetaAberta(false);
    };

    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [gavetaAberta]);

  const navegacao = (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4" aria-label="Seções">
      {grupos.map((grupo) => (
        <div key={grupo.titulo ?? 'principal'} className="flex flex-col gap-1">
          {grupo.titulo && (
            <p className="text-muted-foreground px-3 pb-1 text-[0.6875rem] font-semibold tracking-wider uppercase">
              {grupo.titulo}
            </p>
          )}

          {grupo.itens.map((item) => {
            const estaAtivo = item.href === ativo;

            return (
              <Link
                key={item.href}
                href={item.href}
                // Navegar fecha a gaveta. Sem isto, o usuário toca num item no
                // celular e fica olhando para o menu ainda aberto por cima da
                // página que acabou de carregar. No desktop não tem efeito
                // nenhum, já que lá a gaveta nunca está aberta.
                onClick={() => setGavetaAberta(false)}
                // `aria-current` informa a posição a quem usa leitor de tela.
                // Fundo colorido, sozinho, não diz nada para essa pessoa.
                aria-current={estaAtivo ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  estaAtivo
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <item.icone aria-hidden className="size-4 shrink-0" />
                {item.rotulo}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const identificacao = (
    <div className="flex min-w-0 flex-col px-5 py-4">
      <span className="truncate text-sm font-semibold tracking-tight">{usuario.nomeEmpresa}</span>
      <span className="text-muted-foreground truncate text-xs">
        {usuario.nome} · {ROTULO_PAPEL[usuario.papel]}
      </span>
    </div>
  );

  const rodape = (
    <div className="flex items-center justify-between gap-2 border-t px-3 py-3">
      <AlternadorTema />

      <form action={aoSair}>
        <button
          type="submit"
          className="text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors"
        >
          <LogOut aria-hidden className="size-4" />
          Sair
        </button>
      </form>
    </div>
  );

  return (
    <div className="bg-background min-h-screen">
      {/* Lateral fixa, a partir de telas médias. */}
      <aside className="bg-superficie fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r md:flex">
        {identificacao}
        {navegacao}
        {rodape}
      </aside>

      {/* Barra superior, só em tela estreita: é onde mora o botão da gaveta. */}
      <header className="bg-background/85 sticky top-0 z-20 flex items-center gap-3 border-b px-4 py-3 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => setGavetaAberta(true)}
          aria-label="Abrir menu"
          aria-expanded={gavetaAberta}
          className="hover:bg-accent -ml-1 rounded-md p-1.5 transition-colors"
        >
          <Menu aria-hidden className="size-5" />
        </button>

        <span className="truncate text-sm font-semibold tracking-tight">{usuario.nomeEmpresa}</span>
      </header>

      {gavetaAberta && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Clicar fora fecha. É `button` para funcionar também no teclado. */}
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setGavetaAberta(false)}
            className="absolute inset-0 h-full w-full bg-black/40"
          />

          <div className="bg-superficie absolute inset-y-0 left-0 flex w-64 flex-col border-r shadow-[var(--sombra-media)]">
            <div className="flex items-start justify-between">
              {identificacao}

              <button
                type="button"
                onClick={() => setGavetaAberta(false)}
                aria-label="Fechar menu"
                className="hover:bg-accent m-3 rounded-md p-1.5 transition-colors"
              >
                <X aria-hidden className="size-5" />
              </button>
            </div>

            {navegacao}
            {rodape}
          </div>
        </div>
      )}

      <div className="md:pl-60">
        {/*
          Largura máxima generosa e não centralizada em excesso: tabela e quadro
          de funil precisam de espaço horizontal. O limite existe só para o
          texto não virar linha longa demais em monitor ultrawide.
        */}
        <main className="mx-auto w-full max-w-[88rem] px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
