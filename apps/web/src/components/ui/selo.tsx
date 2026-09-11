import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Selo de status.
 *
 * O tom carrega significado, não decoração: verde é desfecho bom, âmbar é algo
 * que ainda depende de alguém, vermelho é problema, cinza é neutro ou
 * encerrado sem consequência.
 *
 * Cor sozinha não pode ser o único sinal — cerca de 8% dos homens têm alguma
 * deficiência de visão de cores. Por isso o selo sempre mostra o texto do
 * status; a cor reforça, não substitui.
 */
const estilosSelo = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tom: {
        neutro: 'border-border bg-muted text-muted-foreground',
        sucesso: 'border-sucesso/25 bg-sucesso-suave text-sucesso',
        atencao: 'border-atencao/30 bg-atencao-suave text-atencao',
        perigo: 'border-destructive/25 bg-destrutivo-suave text-destructive',
        info: 'border-info/25 bg-info-suave text-info',
      },
    },
    defaultVariants: { tom: 'neutro' },
  },
);

interface SeloProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof estilosSelo> {
  /** Mostra um ponto colorido antes do texto, útil em listas longas. */
  comPonto?: boolean;
}

export function Selo({ tom, comPonto = false, className, children, ...props }: SeloProps) {
  return (
    <span {...props} className={cn(estilosSelo({ tom }), className)}>
      {comPonto && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
