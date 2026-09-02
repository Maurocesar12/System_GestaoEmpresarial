import Link from 'next/link';
import { cn } from '@/lib/utils';

interface Props {
  /** Rota base da tela, sem parâmetros. */
  base: string;
  /** Nome do parâmetro na URL. */
  parametro: string;
  /** O valor deste filtro. `undefined` é a opção "todos", que limpa o filtro. */
  valor?: string;
  /** O valor que está aplicado agora. */
  atual?: string;
  rotulo: string;
}

/**
 * Filtro de lista, como link.
 *
 * É `<a>` e não `<button>` porque filtrar muda a URL: o usuário pode voltar,
 * recarregar e compartilhar o recorte que está vendo. Um botão que troca estado
 * no cliente perde as três coisas.
 *
 * `aria-current` marca o filtro ativo para quem usa leitor de tela — o fundo
 * colorido, sozinho, não é anunciado.
 */
export function FiltroLink({ base, parametro, valor, atual, rotulo }: Props) {
  const ativo = atual === valor;
  const href = valor ? `${base}?${parametro}=${valor}` : base;

  return (
    <Link
      href={href}
      aria-current={ativo ? 'page' : undefined}
      className={cn(
        'inline-flex h-9 items-center rounded-md border px-3 text-sm transition-colors',
        ativo
          ? 'bg-primary text-primary-foreground border-primary font-medium'
          : 'bg-card hover:bg-accent text-muted-foreground hover:text-foreground',
      )}
    >
      {rotulo}
    </Link>
  );
}

/** A linha de filtros. Rola de lado no celular em vez de quebrar em duas alturas. */
export function BarraDeFiltros({
  children,
  rotulo,
}: {
  children: React.ReactNode;
  rotulo: string;
}) {
  return (
    <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label={rotulo}>
      {children}
    </nav>
  );
}
