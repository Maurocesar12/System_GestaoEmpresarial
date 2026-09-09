import { cn } from '@/lib/utils';

interface SimboloMarcaProps {
  className?: string;
}

/** Símbolo da marca: evolução do negócio em leitura mínima de dashboard. */
export function SimboloMarca({ className }: SimboloMarcaProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      className={cn('size-7 shrink-0', className)}
      fill="none"
    >
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path
        d="M8.5 22.5h15"
        className="stroke-primary-foreground opacity-40"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M9.25 21v-4.25m6.75 4.25v-7.5M22.75 21V10.75"
        className="stroke-primary-foreground"
        strokeWidth="2.45"
        strokeLinecap="round"
      />
      <path
        d="M9.25 16.75 16 13.5l3.6 2.05 3.15-4.8"
        className="stroke-primary-foreground opacity-80"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
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
