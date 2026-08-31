import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Estilos de ação, num lugar só.
 *
 * Exportado separado do componente porque nem toda ação é um `<button>`: "Novo
 * cliente" navega, e navegação precisa ser um `<a>` de verdade — para abrir em
 * nova aba, aparecer no histórico e ser anunciada como link pelo leitor de
 * tela. Com o `cva` aqui fora, o `<Link>` do Next usa exatamente o mesmo visual
 * sem virar um botão falso:
 *
 * ```tsx
 * <Link href="/painel/clientes/novo" className={estilosBotao()}>Novo cliente</Link>
 * ```
 *
 * Antes deste arquivo, essa combinação de classes estava copiada em 18 telas —
 * e já havia divergido entre elas.
 */
export const estilosBotao = cva(
  cn(
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap',
    'transition-[background-color,border-color,color,box-shadow] duration-150',
    'disabled:pointer-events-none disabled:opacity-50',
    // Ícone do lucide dentro do botão: tamanho fixo e sem encolher, para não
    // deformar quando o texto for longo.
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ),
  {
    variants: {
      variante: {
        /** Ação principal da tela. No máximo uma por tela — se tudo é primário, nada é. */
        primario:
          'bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--sombra-sutil)]',
        /** Ação secundária: mesma importância visual da superfície, com contorno. */
        secundario: 'border bg-card hover:bg-accent text-foreground shadow-[var(--sombra-sutil)]',
        /** Ação terciária, sem peso: filtros, ações de linha de tabela. */
        sutil: 'hover:bg-accent text-muted-foreground hover:text-foreground',
        /** Ação destrutiva confirmada — excluir, cancelar em definitivo. */
        perigo: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        /** Parece texto, comporta-se como ação. */
        link: 'text-primary underline-offset-4 hover:underline',
      },
      tamanho: {
        /** Ações dentro de tabela e barra de filtros, onde o espaço é disputado. */
        sm: 'h-8 gap-1.5 px-3 text-xs',
        /** Padrão. Mesma altura do `Campo`, para não desalinhar numa linha de formulário. */
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-6 text-sm',
        /** Quadrado, para ação representada só por ícone. Exige `aria-label`. */
        icone: 'size-10',
      },
    },
    defaultVariants: {
      variante: 'primario',
      tamanho: 'md',
    },
  },
);

interface BotaoProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof estilosBotao> {
  /** Bloqueia o botão e mostra o giro de espera, sem esconder o rótulo. */
  carregando?: boolean;
}

/**
 * Botão de ação.
 *
 * Com `carregando`, o botão fica desabilitado — é o que impede o clique duplo
 * de criar dois registros. O rótulo continua visível de propósito: trocá-lo por
 * "Aguarde…" faz o botão mudar de largura e o layout pular justamente no
 * instante em que o usuário está olhando para ele.
 */
export function Botao({
  variante,
  tamanho,
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
      // ele, a espera é silenciosa para quem não vê o giro.
      aria-busy={carregando}
      className={cn(estilosBotao({ variante, tamanho }), className)}
    >
      {carregando && <Loader2 aria-hidden className="animate-spin" />}
      {children}
    </button>
  );
}
