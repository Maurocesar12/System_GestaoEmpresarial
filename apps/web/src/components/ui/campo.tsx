import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Classes do controle de entrada.
 *
 * Exportadas porque `<select>` e `<textarea>` precisam parecer o mesmo
 * elemento que o `<input>`. Sem um lugar único, os três divergem em altura e
 * cor de borda — e é sempre o `<select>` que fica com dois pixels a menos.
 */
export const estilosControle = cn(
  'w-full rounded-md border bg-card px-3 text-sm transition-colors',
  'placeholder:text-muted-foreground',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'aria-[invalid=true]:border-destructive',
);

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
 *
 * O espaço da mensagem é reservado mesmo quando não há mensagem. Assim o
 * formulário não "pula" quando um erro aparece, empurrando o botão para longe
 * do cursor no momento exato em que o usuário vai clicar nele.
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
        className={cn(estilosControle, 'h-10', className)}
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
