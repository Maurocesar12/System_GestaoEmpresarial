'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Painel que desliza da direita, para editar algo sem sair da lista.
 *
 * `<dialog>` nativo, como o cartão do funil: `showModal()` dá de graça o Esc,
 * a prisão de foco, o fundo inerte para leitores de tela e o `::backdrop`.
 * Monte o componente só quando ele estiver aberto; fechar (Esc, X, clique
 * fora ou `aoFechar` chamado pelo conteúdo) desmonta.
 *
 * O rodapé fica fixo: num formulário longo, o botão de salvar não pode ficar
 * no fim de uma rolagem que a pessoa nem sabe que existe.
 */
export function PainelLateral({
  titulo,
  descricao,
  aoFechar,
  rodape,
  children,
}: {
  titulo: string;
  descricao?: ReactNode;
  aoFechar: () => void;
  rodape?: ReactNode;
  children: ReactNode;
}) {
  const janela = useRef<HTMLDialogElement>(null);

  // `showModal()` só existe no cliente e roda depois da montagem.
  useEffect(() => {
    janela.current?.showModal();
  }, []);

  return (
    <dialog
      ref={janela}
      onClose={aoFechar}
      // O alvo é o próprio `<dialog>` só quando o clique cai no backdrop.
      onClick={(evento) => {
        if (evento.target === janela.current) janela.current?.close();
      }}
      aria-label={titulo}
      className={cn(
        'painel-lateral bg-card text-card-foreground border-l p-0 shadow-[var(--sombra-media)]',
        // Encostado à direita, altura inteira; no celular ocupa a tela toda.
        'fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-xl',
        'backdrop:bg-black/45 backdrop:backdrop-blur-[2px]',
      )}
    >
      <div className="flex h-full flex-col">
        <header className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="truncate text-base font-semibold">{titulo}</h2>
            {descricao && <div className="text-muted-foreground text-xs">{descricao}</div>}
          </div>
          <button
            type="button"
            onClick={() => janela.current?.close()}
            aria-label="Fechar"
            className="text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 rounded-md p-1.5 transition-colors"
          >
            <X aria-hidden className="size-4" />
          </button>
        </header>

        {/* `overscroll-contain`: no fim do formulário, a rolagem não vaza para a página de trás. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          {children}
        </div>

        {rodape && (
          <footer className="bg-muted/30 flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
            {rodape}
          </footer>
        )}
      </div>
    </dialog>
  );
}
