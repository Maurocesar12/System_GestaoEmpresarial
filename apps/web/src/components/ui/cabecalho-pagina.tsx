import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  titulo: string;
  /** Uma frase dizendo o que a tela responde — não o que ela é. */
  descricao?: ReactNode;
  /** Botões da tela. A ação principal vai por último, encostada à direita. */
  acoes?: ReactNode;
  /** Link de volta, em telas de detalhe. */
  voltar?: { href: string; rotulo: string };
}

/**
 * Cabeçalho de tela.
 *
 * Toda página do painel abria com o mesmo bloco montado à mão, e o espaçamento
 * já variava entre elas. Concentrado aqui, mudar a hierarquia do título é uma
 * edição só.
 *
 * `flex-wrap` com `items-end` é o que faz as ações caírem para baixo do título
 * no celular em vez de espremerem a linha até o texto quebrar palavra a palavra.
 */
export function CabecalhoPagina({ titulo, descricao, acoes, voltar }: Props) {
  return (
    <header className="flex flex-col gap-3">
      {voltar && (
        <Link
          href={voltar.href}
          className="text-muted-foreground hover:text-foreground -mb-1 flex w-fit items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft aria-hidden className="size-3.5" />
          {voltar.rotulo}
        </Link>
      )}

      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
          {descricao && <p className="text-muted-foreground text-sm">{descricao}</p>}
        </div>

        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </div>
    </header>
  );
}
