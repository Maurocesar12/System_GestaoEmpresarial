import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primario' | 'secundario';
  carregando?: boolean;
}

/**
 * Botão de ação.
 *
 * Quando `carregando` está ativo, o botão fica desabilitado e troca o texto —
 * é o que impede o clique duplo de criar duas empresas ou disparar dois logins.
 */
export function Botao({
  variante = 'primario',
  carregando = false,
  disabled,
  children,
  className,
  ...props
}: BotaoProps) {
  return (
    <button
      {...props}
      disabled={disabled || carregando}
      // `aria-busy` avisa o leitor de tela que a ação está em andamento; sem
      // ele, a espera é silenciosa para quem não vê a mudança de texto.
      aria-busy={carregando}
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        'disabled:pointer-events-none disabled:opacity-60',
        variante === 'primario' && 'bg-primary text-primary-foreground hover:bg-primary/90',
        variante === 'secundario' && 'border bg-transparent hover:bg-accent',
        className,
      )}
    >
      {carregando ? 'Aguarde…' : children}
    </button>
  );
}
