import Link from 'next/link';
import { X } from 'lucide-react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Filtro do sistema, num padrão só.
 *
 * A ideia é uma linha, sem card em volta e sem rótulo escrito acima de cada
 * campo: o rótulo vira `aria-label` (para leitor de tela) e placeholder (para
 * quem vê a tela). Um rótulo visível faz sentido num cadastro, onde a pessoa
 * ainda não sabe o que preencher; num filtro, o valor já selecionado — ou o
 * placeholder — já diz do que se trata, e repetir "De" acima de um campo de
 * data é peso que a tela carrega para nada.
 *
 * Continua sendo `<form method="get">`: o filtro é a URL, não estado do React.
 * Assim ele é compartilhável por link, sobrevive ao recarregar e funciona com
 * o botão voltar do navegador.
 */
export function BarraFiltros({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <form method="get" className={cn('flex flex-wrap items-center gap-2', className)}>
      {children}
    </form>
  );
}

const ESTILO_CAMPO =
  'h-9 rounded-md border bg-card px-3 text-sm transition-colors placeholder:text-muted-foreground ' +
  'focus-visible:ring-ring focus-visible:border-ring focus-visible:ring-2 focus-visible:outline-none';

interface CampoFiltroProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Vira `aria-label` sempre, e placeholder quando nenhum é passado. */
  rotulo: string;
}

export function CampoFiltro({ rotulo, className, placeholder, ...props }: CampoFiltroProps) {
  return (
    <input
      {...props}
      aria-label={rotulo}
      placeholder={placeholder ?? rotulo}
      className={cn(ESTILO_CAMPO, 'w-full sm:w-auto', className)}
    />
  );
}

interface SelecaoFiltroProps extends SelectHTMLAttributes<HTMLSelectElement> {
  rotulo: string;
}

/**
 * `<select>` sem rótulo visível.
 *
 * `appearance-none` mais a seta desenhada à mão não vale a pena aqui — é um
 * detalhe visual, e o nativo já é compacto o bastante para um filtro. A versão
 * com seta própria (`Selecao`, em `campo.tsx`) continua para formulários.
 */
export function SelecaoFiltro({ rotulo, className, children, ...props }: SelecaoFiltroProps) {
  return (
    <select
      {...props}
      aria-label={rotulo}
      className={cn(ESTILO_CAMPO, 'cursor-pointer', className)}
    >
      {children}
    </select>
  );
}

/**
 * Some quando não há filtro aplicado — "limpar" sem nada para limpar é um
 * link morto ocupando espaço.
 */
export function LinkLimparFiltros({ href, ativo }: { href: string; ativo: boolean }) {
  if (!ativo) return null;

  return (
    <Link
      href={href}
      className="text-muted-foreground hover:text-foreground inline-flex h-9 items-center gap-1 px-1.5 text-xs transition-colors"
    >
      <X aria-hidden className="size-3.5" />
      Limpar
    </Link>
  );
}
