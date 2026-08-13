import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface CampoProps extends InputHTMLAttributes<HTMLInputElement> {
  rotulo: string;
  /** Mensagem de validação. Quando presente, o campo é marcado como inválido. */
  erro?: string;
  /** Texto de apoio abaixo do campo, quando não há erro. */
  ajuda?: string;
}

/**
 * Campo de formulário com rótulo, mensagem de erro e estado de foco.
 *
 * Usa `forwardRef` porque o React Hook Form precisa da referência do input para
 * registrá-lo — sem isso, o campo não seria controlado pela biblioteca.
 *
 * Acessibilidade não é enfeite aqui: `aria-invalid` e `aria-describedby` são o
 * que faz um leitor de tela anunciar "e-mail, inválido, e-mail inválido" em vez
 * de apenas "e-mail".
 */
export const Campo = forwardRef<HTMLInputElement, CampoProps>(function Campo(
  { rotulo, erro, ajuda, id, className, ...props },
  ref,
) {
  const idCampo = id ?? props.name;
  const idMensagem = `${idCampo}-mensagem`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={idCampo} className="text-sm font-medium">
        {rotulo}
      </label>

      <input
        {...props}
        id={idCampo}
        ref={ref}
        aria-invalid={Boolean(erro)}
        aria-describedby={erro || ajuda ? idMensagem : undefined}
        className={cn(
          'h-10 rounded-md border bg-transparent px-3 text-sm transition-colors',
          'placeholder:text-muted-foreground',
          'focus-visible:ring-ring focus-visible:border-ring focus-visible:ring-2 focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          erro && 'border-destructive focus-visible:ring-destructive',
          className,
        )}
      />

      {(erro || ajuda) && (
        <p
          id={idMensagem}
          className={cn('text-xs', erro ? 'text-destructive' : 'text-muted-foreground')}
        >
          {erro ?? ajuda}
        </p>
      )}
    </div>
  );
});
