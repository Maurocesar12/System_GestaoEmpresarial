'use client';

import { useDroppable } from '@dnd-kit/core';
import { formatarBRL, type ClienteNoFunil, type Etiqueta } from '@gestao/shared-types';
import { cn } from '@/lib/utils';
import { NovoCartao } from './novo-cartao';
import { CartaoDoFunil, COR_DA_ETAPA } from './cartao-do-funil';

/**
 * Uma coluna do quadro.
 *
 * Altura fixa com rolagem **interna**: sem isso, uma coluna com trinta clientes
 * esticaria a página e as outras colunas ficariam com um rodapé inalcançável a
 * três telas de distância. Rolando por dentro, o cabeçalho e o "adicionar
 * cliente" continuam sempre à vista.
 */
export function Coluna({
  id,
  nome,
  indice,
  clientes,
  total,
  etapas,
  etiquetas,
  aoTrocarEtapa,
  aoAbrir,
}: {
  id: string;
  nome: string;
  /** Posição da etapa no funil — define a cor do marcador. */
  indice: number;
  clientes: ClienteNoFunil[];
  /** Valor em negociação da etapa, somado pela API. */
  total: string;
  etapas: { id: string; nome: string }[];
  etiquetas: Etiqueta[];
  aoTrocarEtapa: (clienteId: string, etapaId: string, chaveDeFoco?: string) => void;
  aoAbrir: (clienteId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  // Quanto há em negociação nesta etapa. É o número que transforma o quadro de
  // lista de nomes em leitura de negócio: "tenho R$ 18 mil parados em
  // orçamento enviado".

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'bg-superficie/95 flex max-h-[calc(100vh-18rem)] min-h-[34rem] w-[19rem] shrink-0 flex-col rounded-xl border shadow-(--sombra-sutil) backdrop-blur-sm transition-colors',
        // Realce durante o arrasto: sem ele, não fica claro onde o cartão cai.
        isOver && 'border-primary bg-primary/5',
      )}
    >
      {/*
        Cabeçalho fixo: com a coluna rolando por dentro, ele precisa continuar
        visível — saber em que etapa se está enquanto se percorre trinta
        clientes é o mínimo para não se perder.
      */}
      <header className="bg-superficie/95 sticky top-0 z-10 flex flex-col gap-2 rounded-t-xl border-b px-3 py-3 backdrop-blur-sm">
        <span aria-hidden className={cn('h-1 rounded-full', COR_DA_ETAPA[indice % 5])} />
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            {/* O ponto colorido dá à etapa uma identidade que o olho reconhece
                de relance, sem precisar ler o título de cada coluna. */}
            <span aria-hidden className={cn('size-2 rounded-full', COR_DA_ETAPA[indice % 5])} />
            {nome}
          </h2>

          <span className="text-muted-foreground numerico bg-background/70 rounded-full px-2 py-0.5 text-xs font-medium">
            {clientes.length}
          </span>
        </div>

        {Number(total) > 0 && (
          <p className="numerico text-muted-foreground pl-4 text-xs">
            <span className="text-foreground font-semibold">{formatarBRL(total)}</span> em
            negociação
          </p>
        )}
      </header>

      {/* `relative`: os rótulos `sr-only` dos cartões ficam presos à coluna, sem esticar a página. */}
      <div className="relative flex flex-1 flex-col gap-2 overflow-y-auto px-2 py-2">
        {clientes.map((cliente) => (
          <CartaoDoFunil
            key={cliente.id}
            cliente={cliente}
            etapaAtual={id}
            corEtapa={COR_DA_ETAPA[indice % COR_DA_ETAPA.length]!}
            etapas={etapas}
            aoTrocarEtapa={(etapaId, chaveDeFoco) =>
              aoTrocarEtapa(cliente.id, etapaId, chaveDeFoco)
            }
            aoAbrir={() => aoAbrir(cliente.id)}
          />
        ))}

        {clientes.length === 0 && (
          <p
            className={cn(
              'rounded-lg border border-dashed px-3 py-8 text-center text-xs transition-colors',
              isOver ? 'border-primary text-primary' : 'text-muted-foreground',
            )}
          >
            {isOver ? 'Solte aqui' : 'Nenhum cliente nesta etapa'}
          </p>
        )}
      </div>

      <div className="px-2 pb-2">
        <NovoCartao etapaId={id} etapaNome={nome} etiquetas={etiquetas} />
      </div>
    </section>
  );
}
