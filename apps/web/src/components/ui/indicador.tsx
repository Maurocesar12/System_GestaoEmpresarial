import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type TomIndicador = 'neutro' | 'positivo' | 'negativo';

const COR_DO_TOM: Record<TomIndicador, string> = {
  neutro: 'text-foreground',
  positivo: 'text-sucesso',
  negativo: 'text-destructive',
};

interface IndicadorProps {
  titulo: string;
  /** Já formatado pelo chamador. O componente não sabe se é dinheiro ou contagem. */
  valor: string;
  /** Uma linha de contexto: o que esse número significa, ou de onde ele vem. */
  detalhe?: ReactNode;
  /** Quando informado, o cartão inteiro vira link para a tela que detalha o número. */
  href?: string;
  tom?: TomIndicador;
  /** Puxa o cartão para frente. No máximo um por grupo. */
  destaque?: boolean;
}

/**
 * Número em destaque.
 *
 * Existia copiado em quatro telas, e as cópias já tinham divergido — uma em
 * `text-xl`, outra em `text-2xl`, uma formatando o dinheiro por dentro e outra
 * recebendo formatado.
 *
 * O valor chega **pronto**. Formatar aqui dentro obrigaria o componente a saber
 * se aquilo é moeda, contagem ou percentual, e foi exatamente essa dúvida que
 * fez as cópias divergirem.
 *
 * `tabular-nums` não é detalhe: sem largura fixa de dígito, os números dos
 * cartões lado a lado não alinham e a linha inteira parece torta.
 */
export function Indicador({
  titulo,
  valor,
  detalhe,
  href,
  tom = 'neutro',
  destaque = false,
}: IndicadorProps) {
  const conteudo = (
    <>
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{titulo}</p>
      <p className={cn('mt-1 text-2xl font-semibold tracking-tight tabular-nums', COR_DO_TOM[tom])}>
        {valor}
      </p>
      {detalhe && <p className="text-muted-foreground mt-0.5 text-xs">{detalhe}</p>}
    </>
  );

  const classes = cn(
    'bg-card rounded-lg border p-4 shadow-[var(--sombra-sutil)] transition-colors',
    destaque && 'ring-primary/20 ring-1',
  );

  if (!href) {
    return <div className={classes}>{conteudo}</div>;
  }

  return (
    <Link href={href} className={cn(classes, 'hover:border-primary/40 hover:bg-accent/40 block')}>
      {conteudo}
    </Link>
  );
}

/**
 * Faixa de indicadores.
 *
 * Uma coluna no celular, duas no tablet, quatro no desktop. Fica aqui para as
 * telas não reinventarem o ponto de quebra cada uma do seu jeito — era o que
 * acontecia, e o painel e o financeiro já discordavam entre si.
 */
export function FaixaDeIndicadores({ children }: { children: ReactNode }) {
  return <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</section>;
}
