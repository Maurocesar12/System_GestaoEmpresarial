'use client';

import type { StatusLembrete } from '@gestao/shared-types';
import { useState, useTransition } from 'react';
import { cancelarLembrete } from './acoes';

export function AcoesLembrete({ id, status }: { id: string; status: StatusLembrete }) {
  const [erro, setErro] = useState<string>();
  const [cancelando, iniciar] = useTransition();

  if (status !== 'pendente') {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={cancelando}
        onClick={() =>
          iniciar(async () => {
            setErro(undefined);
            const resultado = await cancelarLembrete(id);
            setErro(resultado.erro);
          })
        }
        className="focus-visible:ring-ring hover:bg-accent inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
      >
        Cancelar
      </button>

      {erro && (
        <p role="alert" className="text-destructive max-w-48 text-right text-xs">
          {erro}
        </p>
      )}
    </div>
  );
}
