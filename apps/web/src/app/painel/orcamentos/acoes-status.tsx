'use client';

import { ROTULO_ACAO, acoesDisponiveis, type StatusOrcamento } from '@gestao/shared-types';
import { useState, useTransition } from 'react';
import { mudarStatus } from './acoes';

/**
 * Botões de transição de um orçamento.
 *
 * Quais botões aparecem sai de `acoesDisponiveis`, a mesma tabela de transições
 * que a API usa para validar. Uma tabela só significa que a tela nunca oferece
 * uma ação que o servidor vai recusar — nem esconde uma que ele aceitaria.
 */
export function AcoesStatus({ id, status }: { id: string; status: StatusOrcamento }) {
  const [erro, setErro] = useState<string>();
  const [executando, iniciar] = useTransition();

  const acoes = acoesDisponiveis(status);

  if (acoes.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        {acoes.map((acao) => (
          <button
            key={acao}
            type="button"
            disabled={executando}
            onClick={() =>
              iniciar(async () => {
                setErro(undefined);
                const resultado = await mudarStatus(id, acao);
                setErro(resultado.erro);
              })
            }
            className="hover:bg-accent focus-visible:ring-ring inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          >
            {ROTULO_ACAO[acao]}
          </button>
        ))}
      </div>

      {erro && (
        <p role="alert" className="text-destructive text-xs">
          {erro}
        </p>
      )}
    </div>
  );
}
