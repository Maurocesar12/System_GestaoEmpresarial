'use client';

import Link from 'next/link';
import { ChevronDown, Filter, X } from 'lucide-react';
import {
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

/**
 * Filtro do sistema, num padrão só.
 *
 * Fica recolhido atrás de um botão "Filtros": a tela some por padrão e só
 * ocupa espaço quando a pessoa escolhe abrir. Quando já existe filtro
 * aplicado — a página foi aberta por um link com `?busca=...`, por exemplo —
 * a barra já nasce aberta, para não esconder o que a pessoa já escolheu.
 *
 * Dentro, cada campo não tem rótulo escrito acima: o rótulo vira `aria-label`
 * (leitor de tela) e placeholder (quem vê a tela). Um rótulo visível faz
 * sentido num cadastro, onde a pessoa ainda não sabe o que preencher; num
 * filtro, o valor já selecionado — ou o placeholder — já diz do que se trata.
 *
 * Continua sendo `<form method="get">`: o filtro é a URL, não estado do React.
 * Assim ele é compartilhável por link, sobrevive ao recarregar e funciona com
 * o botão voltar do navegador. Trocar de página é navegação de verdade — o
 * componente remonta e `aberto` volta a refletir o `ativo` da URL nova.
 */
export function BarraFiltros({
  children,
  ativo = false,
  className,
}: {
  children: ReactNode;
  /** Já existe filtro aplicado nesta URL. */
  ativo?: boolean;
  className?: string;
}) {
  const [aberto, setAberto] = useState(ativo);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        aria-expanded={aberto}
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
          'text-muted-foreground hover:bg-accent hover:text-foreground',
          ativo && 'text-foreground',
        )}
      >
        <Filter aria-hidden className="size-3.5" />
        Filtros
        {ativo && <span aria-hidden className="bg-primary inline-block size-1.5 rounded-full" />}
        <ChevronDown
          aria-hidden
          className={cn('size-3.5 transition-transform', aberto && 'rotate-180')}
        />
      </button>

      {aberto && (
        <form method="get" className="mt-2 flex flex-wrap items-center gap-2">
          {children}
        </form>
      )}
    </div>
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
