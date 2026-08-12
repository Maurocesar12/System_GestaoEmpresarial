import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Junta classes condicionais resolvendo conflitos do Tailwind — `cn('p-2', 'p-4')`
 * devolve `p-4`, e não as duas. É o utilitário que os componentes do shadcn/ui
 * esperam encontrar em `@/lib/utils`.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
