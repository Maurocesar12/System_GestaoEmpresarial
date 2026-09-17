'use client';

import {
  ROTULO_ACAO_AGENDAMENTO,
  acoesAgendamentoDisponiveis,
  type StatusAgendamento,
} from '@gestao/shared-types';
import { useState, useTransition } from 'react';
import {
  EditorMateriais,
  type LinhaMaterial,
  type MaterialDoCatalogo,
} from '@/components/painel/editor-materiais';
import { Botao } from '@/components/ui/botao';
import { mudarStatusAgendamento } from './acoes';

/**
 * Botões de transição de um agendamento.
 *
 * Quais aparecem sai de `acoesAgendamentoDisponiveis`, a mesma tabela que a API
 * usa para validar. A tela nunca oferece uma ação que o servidor recusaria.
 *
 * Com `catalogo`, executar abre antes a conferência dos materiais usados. Sem
 * ele (na lista da agenda), a API baixa a lista padrão do serviço.
 */
export function AcoesAgendamento({
  id,
  status,
  catalogo,
  materiaisPadrao = [],
}: {
  id: string;
  status: StatusAgendamento;
  catalogo?: MaterialDoCatalogo[];
  materiaisPadrao?: LinhaMaterial[];
}) {
  const [erro, setErro] = useState<string>();
  const [executando, iniciar] = useTransition();
  const [conferindo, setConferindo] = useState(false);
  const [linhas, setLinhas] = useState(materiaisPadrao);

  const acoes = acoesAgendamentoDisponiveis(status);

  if (acoes.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  if (conferindo && catalogo) {
    return (
      <div className="flex w-full flex-col gap-3 rounded-md border p-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Materiais usados neste serviço</p>
          <p className="text-muted-foreground text-xs">
            Confira as quantidades. O estoque baixa pelo custo médio e o custo entra na margem do
            serviço.
          </p>
        </div>

        <EditorMateriais
          catalogo={catalogo}
          linhas={linhas}
          aoMudar={setLinhas}
          desabilitado={executando}
        />

        <div className="flex flex-wrap gap-2">
          <Botao
            type="button"
            carregando={executando}
            onClick={() =>
              iniciar(async () => {
                setErro(undefined);
                const resultado = await mudarStatusAgendamento(id, 'executar', linhas);
                setErro(resultado.erro);
                if (!resultado.erro) setConferindo(false);
              })
            }
          >
            Confirmar execução
          </Botao>
          <Botao type="button" variante="secundario" onClick={() => setConferindo(false)}>
            Voltar
          </Botao>
        </div>

        {erro && (
          <p role="alert" className="text-destructive text-xs">
            {erro}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        {acoes.map((acao) => (
          <button
            key={acao}
            type="button"
            disabled={executando}
            onClick={() => {
              if (acao === 'executar' && catalogo) {
                setErro(undefined);
                setConferindo(true);
                return;
              }

              iniciar(async () => {
                setErro(undefined);
                const resultado = await mudarStatusAgendamento(id, acao);
                setErro(resultado.erro);
              });
            }}
            className={`focus-visible:ring-ring inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50 ${
              // "Executado" é a ação que fecha o ciclo e cria o registro no
              // histórico — merece destaque entre as demais. O verde sai do
              // token de sucesso, o mesmo dos selos, e não de uma cor crua.
              acao === 'executar'
                ? 'border-sucesso/40 bg-sucesso-suave text-sucesso hover:bg-sucesso/20'
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
