import { cn } from '@/lib/utils';

interface SimboloMarcaProps {
  className?: string;
}

/** Símbolo da marca: três barras ascendentes representam evolução do negócio. */
export function SimboloMarca({ className }: SimboloMarcaProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      className={cn('size-7 shrink-0', className)}
      fill="none"
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M9 22v-5m7 5V13m7 9V9"
        className="stroke-primary-foreground"
        strokeWidth="2.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface MarcaProps {
  className?: string;
}

/** Logo completa usada nos pontos públicos da aplicação. */
export function Marca({ className }: MarcaProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <SimboloMarca />
      <span>Gestão Empresarial</span>
    </span>
  );
}
