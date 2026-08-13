'use client';

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  diasNaEtapa,
  formatarTelefone,
  type ClienteNoFunil,
  type QuadroFunil,
} from '@gestao/shared-types';
import { useOptimistic, useState, useTransition } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { moverCliente } from './acoes';

/**
 * Quadro do funil.
 *
 * ## Atualização otimista
 *
 * Quando o cartão é solto, ele aparece na coluna nova **antes** de a API
 * confirmar. Arrastar é um gesto físico: esperar meio segundo pelo servidor
 * para o cartão então pular de lugar quebra a sensação de estar manipulando um
 * objeto. Se a chamada falhar, o `useOptimistic` desfaz sozinho e a mensagem
 * de erro aparece.
 *
 * ## Acessibilidade
 *
 * Arrastar e soltar exclui quem usa teclado ou leitor de tela. O `KeyboardSensor`
 * do dnd-kit resolve metade — Espaço pega o cartão, setas movem, Espaço solta.
 * A outra metade é o `<select>` em cada cartão, que muda a etapa sem gesto
 * nenhum e funciona igual no celular, onde arrastar entre colunas é penoso.
 */
export function Quadro({ quadro }: { quadro: QuadroFunil }) {
  const [erro, setErro] = useState<string>();
  const [, iniciarMovimento] = useTransition();
  const [arrastando, setArrastando] = useState<ClienteNoFunil | null>(null);

  // O estado otimista espelha o quadro e é recalculado quando o servidor
  // devolve dados novos — nenhuma cópia local sobrevive ao recarregamento.
  const [colunas, moverOtimista] = useOptimistic(
    quadro.colunas,
    (atual, { clienteId, etapaId }: { clienteId: string; etapaId: string }) => {
      const cliente = atual.flatMap((c) => c.clientes).find((c) => c.id === clienteId);
      if (!cliente) return atual;

      return atual.map((coluna) => ({
        ...coluna,
        clientes:
          coluna.etapa.id === etapaId
            ? [cliente, ...coluna.clientes.filter((c) => c.id !== clienteId)]
            : coluna.clientes.filter((c) => c.id !== clienteId),
      }));
    },
  );

  const sensores = useSensors(
    // 8px de tolerância antes de considerar arrasto: sem isso, um clique com
    // tremida no mouse viraria movimentação acidental.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const mover = (clienteId: string, etapaId: string) => {
    setErro(undefined);

    iniciarMovimento(async () => {
      moverOtimista({ clienteId, etapaId });
      const resultado = await moverCliente({ clienteId, etapaId });
      setErro(resultado.erro);
    });
  };

  const aoSoltar = (evento: DragEndEvent) => {
    setArrastando(null);

    const etapaDestino = evento.over?.id;
    const clienteId = evento.active.id;

    if (!etapaDestino || typeof etapaDestino !== 'string' || typeof clienteId !== 'string') {
      return;
    }

    // Soltar na mesma coluna de onde saiu não é movimento.
    const origem = colunas.find((c) => c.clientes.some((cl) => cl.id === clienteId));
    if (origem?.etapa.id === etapaDestino) {
      return;
    }

    mover(clienteId, etapaDestino);
  };

  const aoPegar = (evento: DragStartEvent) => {
    const cliente = colunas.flatMap((c) => c.clientes).find((c) => c.id === evento.active.id);
    setArrastando(cliente ?? null);
  };

  return (
    <div className="flex flex-col gap-4">
      {erro && <AvisoErro mensagem={erro} />}

      <DndContext sensors={sensores} onDragStart={aoPegar} onDragEnd={aoSoltar}>
        {/* O quadro rola na horizontal; a página, não. */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {colunas.map((coluna) => (
            <Coluna
              key={coluna.etapa.id}
              id={coluna.etapa.id}
              nome={coluna.etapa.nome}
              quantidade={coluna.clientes.length}
            >
              {coluna.clientes.map((cliente) => (
                <Cartao
                  key={cliente.id}
                  cliente={cliente}
                  etapaAtual={coluna.etapa.id}
                  etapas={colunas.map((c) => c.etapa)}
                  aoTrocarEtapa={(etapaId) => mover(cliente.id, etapaId)}
                />
              ))}
            </Coluna>
          ))}
        </div>

        {/* O cartão que segue o cursor durante o arrasto. */}
        <DragOverlay>
          {arrastando && (
            <div className="bg-card w-64 rounded-md border p-3 shadow-lg">
              <p className="text-sm font-medium">{arrastando.nome}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Coluna({
  id,
  nome,
  quantidade,
  children,
}: {
  id: string;
  nome: string;
  quantidade: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <section
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col gap-3 rounded-lg border p-3 transition-colors ${
        // Realce durante o arrasto: sem ele, não fica claro onde o cartão vai cair.
        isOver ? 'border-primary bg-accent/50' : 'bg-muted/20'
      }`}
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{nome}</h2>
        <span className="text-muted-foreground bg-background rounded-full border px-2 py-0.5 text-xs tabular-nums">
          {quantidade}
        </span>
      </header>

      <div className="flex flex-col gap-2">
        {children}
        {quantidade === 0 && (
          <p className="text-muted-foreground px-1 py-6 text-center text-xs">
            Arraste um cliente para cá
          </p>
        )}
      </div>
    </section>
  );
}

function Cartao({
  cliente,
  etapaAtual,
  etapas,
  aoTrocarEtapa,
}: {
  cliente: ClienteNoFunil;
  etapaAtual: string;
  etapas: { id: string; nome: string }[];
  aoTrocarEtapa: (etapaId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: cliente.id,
  });

  const dias = diasNaEtapa(cliente.atualizadoEm);

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`bg-card flex flex-col gap-2 rounded-md border p-3 ${isDragging ? 'opacity-40' : ''}`}
    >
      {/* Só esta área inicia o arrasto. Se o cartão inteiro fosse arrastável, o
          `<select>` abaixo não abriria — o gesto seria capturado antes. */}
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <p className="text-sm font-medium">{cliente.nome}</p>

        {cliente.telefone && (
          <p className="text-muted-foreground text-xs">{formatarTelefone(cliente.telefone)}</p>
        )}

        <p className="text-muted-foreground mt-1 text-xs">
          {dias === 0
            ? 'Entrou hoje'
            : dias === 1
              ? 'Há 1 dia nesta etapa'
              : `Há ${dias} dias nesta etapa`}
        </p>
      </div>

      {/* Alternativa ao arrasto: funciona por teclado, leitor de tela e no
          celular, onde arrastar entre colunas é desconfortável. */}
      <label className="sr-only" htmlFor={`etapa-${cliente.id}`}>
        Etapa de {cliente.nome}
      </label>
      <select
        id={`etapa-${cliente.id}`}
        value={etapaAtual}
        onChange={(evento) => aoTrocarEtapa(evento.target.value)}
        className="focus-visible:ring-ring h-8 rounded border bg-transparent px-2 text-xs focus-visible:ring-2 focus-visible:outline-none"
      >
        {etapas.map((etapa) => (
          <option key={etapa.id} value={etapa.id}>
            {etapa.nome}
          </option>
        ))}
      </select>
    </article>
  );
}
