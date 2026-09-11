'use client';

import type { UsuarioAutenticado } from '@gestao/shared-types';
import { ChevronLeft, ChevronRight, LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { SimboloMarca } from '@/components/marca';
import { cn } from '@/lib/utils';
import { ChatIa } from './chat-ia';
import { hrefAtivo, menuDoUsuario } from './menu';

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
  /**
   * Só o que o shell desenha e usa para montar o menu.
   *
   * Um `Pick` em vez do `UsuarioAutenticado` inteiro porque a sessão nem
   * sempre vem completa: a lida do cookie pode não trazer campos novos, e o
   * cabeçalho não deveria deixar de renderizar por causa disso.
   */
  usuario: Pick<UsuarioAutenticado, 'nome' | 'papel' | 'permissoes' | 'nomeEmpresa'>;
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

const CHAVE_MENU_ENCOLHIDO = 'gestao:menu-encolhido';

export function ShellPainel({ usuario, aoSair, children }: Props) {
  const caminho = usePathname();
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const [menuEncolhido, setMenuEncolhido] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      return localStorage.getItem(CHAVE_MENU_ENCOLHIDO) === '1';
    } catch {
      return false;
    }
  });

  const grupos = menuDoUsuario(usuario);
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

  function alternarMenuEncolhido() {
    setMenuEncolhido((atual) => {
      const proximo = !atual;
      try {
        localStorage.setItem(CHAVE_MENU_ENCOLHIDO, proximo ? '1' : '0');
      } catch {
        // A ação visual ainda funciona mesmo se o navegador bloquear storage.
      }
      return proximo;
    });
  }

  const navegacao = (encolhido = false) => (
    <nav
      className={cn(
        'flex flex-1 flex-col overflow-y-auto py-4',
        encolhido ? 'items-center gap-5 px-2' : 'gap-6 px-3',
      )}
      aria-label="Seções"
    >
      {grupos.map((grupo) => (
        <div
          key={grupo.titulo ?? 'principal'}
          className={cn('flex flex-col gap-1', encolhido && 'items-center')}
        >
          {grupo.titulo && !encolhido && (
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
                title={encolhido ? item.rotulo : undefined}
                className={cn(
                  'flex items-center rounded-md text-sm transition-colors',
                  encolhido ? 'size-10 justify-center' : 'gap-2.5 px-3 py-2',
                  estaAtivo
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <item.icone aria-hidden className="size-4 shrink-0" />
                {!encolhido && item.rotulo}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const identificacao = (encolhido = false) => (
    <div
      className={cn(
        'flex min-w-0 items-center gap-3 px-4 py-4',
        encolhido && 'flex-col gap-2 px-2',
      )}
    >
      <div className={cn('flex min-w-0 items-center gap-3', encolhido && 'justify-center')}>
        <SimboloMarca />
        {!encolhido && (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold tracking-tight">
              {usuario.nomeEmpresa}
            </span>
            <span className="text-muted-foreground truncate text-xs">
              {usuario.nome} · {ROTULO_PAPEL[usuario.papel]}
            </span>
          </div>
        )}
      </div>
      {encolhido && (
        <span className="sr-only">
          {usuario.nomeEmpresa} · {usuario.nome} · {ROTULO_PAPEL[usuario.papel]}
        </span>
      )}
    </div>
  );

  const rodape = (encolhido = false) => (
    <div
      className={cn(
        'flex items-center gap-2 border-t px-3 py-3',
        encolhido ? 'flex-col justify-center' : 'justify-end',
      )}
    >
      <form action={aoSair}>
        <button
          type="submit"
          title={encolhido ? 'Sair' : undefined}
          aria-label={encolhido ? 'Sair' : undefined}
          className={cn(
            'text-muted-foreground hover:bg-accent hover:text-foreground flex items-center rounded-md text-sm transition-colors',
            encolhido ? 'size-9 justify-center' : 'gap-2 px-2.5 py-1.5',
          )}
        >
          <LogOut aria-hidden className="size-4" />
          {!encolhido && 'Sair'}
        </button>
      </form>
    </div>
  );

  return (
    <div className="fundo-painel min-h-screen">
      {/* Lateral fixa, a partir de telas médias. */}
      <aside
        className={cn(
          'bg-superficie fixed inset-y-0 left-0 z-30 hidden flex-col border-r transition-[width] duration-[180ms] md:flex',
          menuEncolhido ? 'w-20' : 'w-60',
        )}
      >
        {identificacao(menuEncolhido)}
        <button
          type="button"
          onClick={alternarMenuEncolhido}
          aria-label={menuEncolhido ? 'Expandir menu' : 'Encolher menu'}
          title={menuEncolhido ? 'Expandir menu' : 'Encolher menu'}
          className="bg-card text-muted-foreground hover:border-primary hover:text-primary absolute top-5 -right-3 flex size-7 items-center justify-center rounded-full border shadow-[var(--sombra-sutil)] transition-colors"
        >
          {menuEncolhido ? (
            <ChevronRight aria-hidden className="size-4" />
          ) : (
            <ChevronLeft aria-hidden className="size-4" />
          )}
        </button>
        {navegacao(menuEncolhido)}
        {rodape(menuEncolhido)}
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
              {identificacao(false)}

              <button
                type="button"
                onClick={() => setGavetaAberta(false)}
                aria-label="Fechar menu"
                className="hover:bg-accent m-3 rounded-md p-1.5 transition-colors"
              >
                <X aria-hidden className="size-5" />
              </button>
            </div>

            {navegacao(false)}
            {rodape(false)}
          </div>
        </div>
      )}

      <div
        className={cn(
          'min-h-screen transition-[padding-left] duration-[180ms]',
          menuEncolhido ? 'md:pl-20' : 'md:pl-60',
        )}
      >
        {/*
          Largura máxima generosa e não centralizada em excesso: tabela e quadro
          de funil precisam de espaço horizontal. O limite existe só para o
          texto não virar linha longa demais em monitor ultrawide.
        */}
        {/*
          `key` no caminho: força o React a remontar a área de conteúdo a cada
          navegação, e é isso que faz a animação de entrada rodar de novo. Sem
          ela, o elemento é reaproveitado e a animação só toca uma vez, na
          primeira carga.
        */}
        <main
          key={caminho}
          className="entrada-suave mx-auto w-full max-w-[88rem] px-4 py-6 md:px-8 md:py-8"
        >
          {children}
        </main>
      </div>
      <ChatIa />
    </div>
  );
}
