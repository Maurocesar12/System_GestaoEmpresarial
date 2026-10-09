import type { HTMLAttributes } from 'react';
import type { IdConceito } from '@/lib/glossario';
import { cn } from '@/lib/utils';
import { DicaConceito } from './dica-conceito';

/**
 * Superfície de conteúdo.
 *
 * A elevação vem da borda fina somada a uma sombra curta — e não de sombra
 * grande. Em tela com muitos blocos, sombra pesada cria um efeito de "cartas
 * flutuando" que suja a leitura; a borda separa sem chamar atenção para si.
 */
export function Cartao({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        'bg-card text-card-foreground rounded-lg border shadow-(--sombra-sutil)',
        className,
      )}
    />
  );
}

/**
 * Cabeçalho do cartão: título à esquerda, ação opcional à direita.
 *
 * O `justify-between` é o que mantém o par "título / ver todos" alinhado igual
 * em todos os blocos do painel, sem cada tela inventar o próprio espaçamento.
 */
export function CartaoCabecalho({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn('flex items-center justify-between gap-4 border-b px-4 py-3', className)}
    />
  );
}

interface CartaoTituloProps extends HTMLAttributes<HTMLHeadingElement> {
  /** Coloca um "?" depois do título, explicando o termo. */
  conceito?: IdConceito;
}

/**
 * Título do cartão.
 *
 * Com `conceito`, o "?" fica **ao lado** do `<h2>`, e não dentro dele: o nome
 * acessível de um título vem do conteúdo, e o leitor de tela leria "Margem por
 * serviço O que é Margem?" como se o botão fizesse parte do título.
 */
export function CartaoTitulo({ className, conceito, ...props }: CartaoTituloProps) {
  const titulo = (
    <h2 {...props} className={cn('text-sm font-semibold tracking-tight', className)} />
  );

  if (!conceito) {
    return titulo;
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      {titulo}
      <DicaConceito conceito={conceito} />
    </div>
  );
}

export function CartaoConteudo({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('p-4', className)} />;
}

/**
 * Conteúdo em lista dentro do cartão.
 *
 * Usa `divide-y` em vez de borda por item porque assim o último item não
 * precisa de exceção (`last:border-b-0`) — um detalhe que costuma ser esquecido
 * e deixa uma linha solta no rodapé do bloco.
 */
export function CartaoLista({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
  return <ul {...props} className={cn('divide-y', className)} />;
}

export function CartaoItem({ className, ...props }: HTMLAttributes<HTMLLIElement>) {
  return (
    <li
      {...props}
      className={cn(
        'hover:bg-accent/40 flex items-center justify-between gap-4 px-4 py-3 transition-colors',
        className,
      )}
    />
  );
}
