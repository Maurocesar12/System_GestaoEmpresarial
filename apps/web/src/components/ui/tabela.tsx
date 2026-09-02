import type { HTMLAttributes, ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * A tabela e sua rolagem horizontal, sem moldura.
 *
 * A rolagem fica no contêiner e não no `<table>` para o cabeçalho acompanhar a
 * área visível. Sem ela, uma tabela larga empurra a página inteira e o usuário
 * passa a rolar o layout todo de lado para ler uma coluna — em celular, é o
 * defeito mais comum de tabela em sistema web.
 *
 * Não desenha moldura: no sistema, toda tabela vive dentro de um `Cartao`, e é
 * dele que vêm a borda, o fundo e a sombra. Uma variante com moldura própria
 * existiu por um tempo e nunca foi usada — quando precisar, é um `Cartao` em
 * volta.
 */
export function TabelaRolavel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function TabelaCabecalho({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-muted/50 text-muted-foreground border-b text-left">
      <tr>{children}</tr>
    </thead>
  );
}

interface ColunaProps extends ThHTMLAttributes<HTMLTableCellElement> {
  /** Números alinham à direita: é assim que se compara ordem de grandeza. */
  numerica?: boolean;
}

export function TabelaColuna({ numerica = false, className, ...props }: ColunaProps) {
  return (
    <th
      {...props}
      className={cn('px-4 py-2.5 text-xs font-medium', numerica && 'text-right', className)}
    />
  );
}

export function TabelaCorpo({ children }: { children: ReactNode }) {
  return <tbody className="divide-y">{children}</tbody>;
}

export function TabelaLinha({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props} className={cn('hover:bg-accent/40 transition-colors', className)} />;
}

interface CelulaProps extends TdHTMLAttributes<HTMLTableCellElement> {
  numerica?: boolean;
  /** Texto de apoio — cinza, para não competir com a coluna que importa. */
  suave?: boolean;
}

export function TabelaCelula({
  numerica = false,
  suave = false,
  className,
  ...props
}: CelulaProps) {
  return (
    <td
      {...props}
      className={cn(
        'px-4 py-3',
        numerica && 'text-right tabular-nums',
        suave && 'text-muted-foreground',
        className,
      )}
    />
  );
}
