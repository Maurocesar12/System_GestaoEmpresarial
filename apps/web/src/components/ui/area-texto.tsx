import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { estilosControle } from '@/components/ui/campo';
import { cn } from '@/lib/utils';

interface AreaTextoProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  rotulo: string;
  erro?: string;
  ajuda?: string;
}

/**
 * Campo de texto longo.
 *
 * Mesmo rótulo, mesma borda e mesma mensagem de erro do `Campo` — só que sem
 * altura fixa. `field-sizing-content` faz a caixa crescer conforme a pessoa
 * escreve, até o limite de `max-h`, evitando a barra de rolagem dentro de um
 * campo de quatro linhas. Onde o navegador não suporta, `rows` mantém o
 * tamanho inicial e a caixa segue redimensionável pelo canto.
 */
export const AreaTexto = forwardRef<HTMLTextAreaElement, AreaTextoProps>(function AreaTexto(
  { rotulo, erro, ajuda, id, className, rows = 4, ...props },
  ref,
) {
  const idCampo = id ?? props.name;
  const idMensagem = `${idCampo}-mensagem`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={idCampo} className="text-sm font-medium">
        {rotulo}
      </label>

      <textarea
        {...props}
        id={idCampo}
        ref={ref}
        rows={rows}
        aria-invalid={Boolean(erro)}
        aria-describedby={erro || ajuda ? idMensagem : undefined}
        className={cn(estilosControle, 'max-h-64 min-h-20 py-2 [field-sizing:content]', className)}
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
