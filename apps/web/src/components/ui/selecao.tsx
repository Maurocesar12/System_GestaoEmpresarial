import { ChevronDown } from 'lucide-react';
import { forwardRef, type SelectHTMLAttributes } from 'react';
import { estilosControle } from '@/components/ui/campo';
import { cn } from '@/lib/utils';

interface SelecaoProps extends SelectHTMLAttributes<HTMLSelectElement> {
  rotulo: string;
  /** Mensagem de validação. Quando presente, o campo é marcado como inválido. */
  erro?: string;
  /** Texto de apoio abaixo do campo, quando não há erro. */
  ajuda?: string;
}

/**
 * Campo de seleção.
 *
 * O `<select>` nativo é o único controle de formulário que o navegador desenha
 * à sua maneira: a seta fica diferente no Windows, no macOS e no Android, e a
 * altura raramente bate com a do `<input>` ao lado. `appearance-none` desliga
 * esse desenho e a seta volta como ícone nosso — assim os dois campos ficam
 * iguais em qualquer sistema.
 *
 * O que **não** é substituído é a lista de opções em si. Um menu feito à mão
 * pareceria mais moderno e seria pior: o nativo já traz busca por digitação,
 * rolagem por teclado e, no celular, o seletor em roda que a pessoa conhece.
 *
 * A altura, a borda e o foco vêm de `estilosControle`, o mesmo do `Campo` —
 * antes deste arquivo, a mesma linha de classes estava copiada cinco vezes só
 * no formulário de lançamento, e já havia divergido do input ao lado.
 */
export const Selecao = forwardRef<HTMLSelectElement, SelecaoProps>(function Selecao(
  { rotulo, erro, ajuda, id, className, children, ...props },
  ref,
) {
  const idCampo = id ?? props.name;
  const idMensagem = `${idCampo}-mensagem`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={idCampo} className="text-sm font-medium">
        {rotulo}
      </label>

      <div className="relative">
        <select
          {...props}
          id={idCampo}
          ref={ref}
          aria-invalid={Boolean(erro)}
          aria-describedby={erro || ajuda ? idMensagem : undefined}
          className={cn(
            estilosControle,
            // `pr-9` abre espaço para a seta não encostar no texto da opção
            // mais longa.
            'h-10 cursor-pointer appearance-none pr-9',
            className,
          )}
        >
          {children}
        </select>

        {/*
          `pointer-events-none` é o detalhe que faz a seta funcionar: sem ele,
          o clique bateria no ícone em vez de abrir a lista.
        */}
        <ChevronDown
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
        />
      </div>

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
