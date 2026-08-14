'use client';

import {
  ROTULO_ACAO_AGENDAMENTO,
  acoesAgendamentoDisponiveis,
  type StatusAgendamento,
} from '@gestao/shared-types';
import { useState, useTransition } from 'react';
import { mudarStatusAgendamento } from './acoes';

/**
 * Botões de transição de um agendamento.
 *
 * Quais aparecem sai de `acoesAgendamentoDisponiveis`, a mesma tabela que a API
 * usa para validar. A tela nunca oferece uma ação que o servidor recusaria.
 */
export function AcoesAgendamento({ id, status }: { id: string; status: StatusAgendamento }) {
  const [erro, setErro] = useState<string>();
  const [executando, iniciar] = useTransition();

  const acoes = acoesAgendamentoDisponiveis(status);

  if (acoes.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        {acoes.map((acao) => (
          <button
            key={acao}
            type="button"
            disabled={executando}
            onClick={() =>
              iniciar(async () => {
                setErro(undefined);
                const resultado = await mudarStatusAgendamento(id, acao);
                setErro(resultado.erro);
              })
            }
            className={`focus-visible:ring-ring inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50 ${
              // "Executado" é a ação que fecha o ciclo e cria o registro no
              // histórico — merece destaque entre as demais.
              acao === 'executar'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400'
                : 'hover:bg-accent'
            }`}
          >
            {ROTULO_ACAO_AGENDAMENTO[acao]}
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
