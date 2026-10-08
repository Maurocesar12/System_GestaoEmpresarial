import Link from 'next/link';
import { AlertTriangle, Info, TriangleAlert } from 'lucide-react';
import { type AlertaDoPainel, type TomAlerta } from '@gestao/shared-types';
import { cn } from '@/lib/utils';

/** Faixa de alertas do topo do painel. */

const ICONE_DO_TOM: Record<TomAlerta, typeof AlertTriangle> = {
  perigo: TriangleAlert,
  atencao: AlertTriangle,
  info: Info,
};

const ESTILO_DO_TOM: Record<TomAlerta, string> = {
  perigo: 'border-destructive/25 bg-destrutivo-suave/50 text-destructive',
  atencao: 'border-atencao/30 bg-atencao-suave/50 text-atencao',
  info: 'border-border bg-muted/40 text-muted-foreground',
};

/**
 * O que precisa de alguém agora.
 *
 * Vem pronta do servidor, ordenada por gravidade: quem abre o painel lê de cima
 * para baixo e para quando resolve. Cada alerta é um link — avisar sem levar ao
 * lugar onde se resolve seria só ansiedade.
 */
export function FaixaDeAlertas({ alertas }: { alertas: AlertaDoPainel[] }) {
  return (
    <section aria-label="Alertas" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {alertas.map((alerta) => {
        const Icone = ICONE_DO_TOM[alerta.tom];

        return (
          <Link
            key={alerta.id}
            href={alerta.href}
            className={cn(
              'flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors hover:brightness-[0.98]',
              ESTILO_DO_TOM[alerta.tom],
            )}
          >
            <Icone aria-hidden className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{alerta.titulo}</p>
              <p className="text-muted-foreground text-xs">{alerta.detalhe}</p>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
