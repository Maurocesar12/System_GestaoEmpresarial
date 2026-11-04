'use client';

import { ChevronLeft, ChevronRight, Clock, GripVertical, RotateCcw } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { cn } from '@/lib/utils';
import {
  CARTOES_FUNIL,
  COLUNAS_FUNIL,
  reais,
  totaisDoFunil,
  type CartaoFunil,
  type ColunaFunil,
} from './conteudo';

/**
 * O quadro de negociações, de brinquedo, para o visitante mexer.
 *
 * As colunas são etapas que o sistema cria de verdade para toda empresa nova, e
 * os totais respondem a cada movimento — é a forma mais curta de mostrar "o
 * sistema faz a conta" sem pedir que ninguém acredite.
 *
 * ## Três jeitos de mover
 *
 * - **Arrastar**, com o arrastar nativo do navegador (mouse).
 * - **Setas** em cada cartão, para teclado e para o celular, onde o arrastar
 *   nativo não funciona bem. O rótulo diz o destino por extenso.
 * - O mesmo estado nos dois: mover por um ou por outro dá o mesmo resultado.
 *
 * Cada movimento é anunciado numa região `aria-live`, com os totais novos.
 *
 * O destaque de "parado" some quando o cartão muda de etapa, como no sistema:
 * lá, o tempo parado conta desde a última mudança de etapa.
 */
export function FunilInterativo() {
  const [cartoes, setCartoes] = useState<CartaoFunil[]>(() => [...CARTOES_FUNIL]);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [colunaAlvo, setColunaAlvo] = useState<ColunaFunil | null>(null);
  const [anuncio, setAnuncio] = useState('');

  const totais = totaisDoFunil(cartoes);

  function mover(id: string, destino: ColunaFunil) {
    const cartao = cartoes.find((item) => item.id === id);

    if (!cartao || cartao.coluna === destino) {
      return;
    }

    const novos = cartoes.map((item) =>
      item.id === id ? { ...item, coluna: destino, parado: false } : item,
    );
    const novosTotais = totaisDoFunil(novos);

    setCartoes(novos);
    setAnuncio(
      `${cartao.cliente} foi para ${destino}. Fechado: ${reais(novosTotais.fechado)}. Em negociação: ${reais(novosTotais.emNegociacao)}.`,
    );
  }

  function reiniciar() {
    setCartoes([...CARTOES_FUNIL]);
    setAnuncio('Quadro de exemplo reiniciado.');
  }

  function soltar(evento: DragEvent<HTMLDivElement>, coluna: ColunaFunil) {
    evento.preventDefault();
    const id = evento.dataTransfer.getData('text/plain');
    if (id) mover(id, coluna);
    setArrastando(null);
    setColunaAlvo(null);
  }

  return (
    <div className="cartao overflow-hidden">
      {/* Totais: o que o painel do sistema mostraria. */}
      <div className="flex flex-wrap items-end justify-between gap-6 border-b p-5 sm:p-6">
        <div className="flex gap-8 sm:gap-12">
          <Total rotulo="Em negociação" valor={totais.emNegociacao} />
          <Total rotulo="Fechado" valor={totais.fechado} destaque />
        </div>

        <button
          type="button"
          onClick={reiniciar}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium"
        >
          <RotateCcw aria-hidden className="size-3.5" />
          Reiniciar exemplo
        </button>
      </div>

      {/*
        No celular as colunas rolam na horizontal, com encaixe: quatro colunas
        de 15rem não cabem em 390px, e espremê-las tornaria os cartões ilegíveis.
      */}
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto p-4 sm:p-5 lg:grid lg:grid-cols-4 lg:overflow-visible">
        {COLUNAS_FUNIL.map((coluna, indiceColuna) => {
          const daColuna = cartoes.filter((cartao) => cartao.coluna === coluna);
          const soma = daColuna.reduce((total, cartao) => total + cartao.valor, 0);
          const fechado = coluna === 'Fechado';

          return (
            <section
              key={coluna}
              aria-label={`${coluna}: ${daColuna.length} cliente(s), ${reais(soma)}`}
              className="w-[15rem] shrink-0 snap-start lg:w-auto"
            >
              <header className="mb-3 flex items-baseline justify-between gap-2 px-1">
                <h3 className={cn('text-sm font-semibold', fechado && 'text-(--acento)')}>
                  {coluna}
                  <span className="text-muted-foreground ml-1.5 font-normal">
                    {daColuna.length}
                  </span>
                </h3>
                <span className="numerico text-muted-foreground text-xs">{reais(soma)}</span>
              </header>

              <div
                onDragOver={(evento) => {
                  evento.preventDefault();
                  evento.dataTransfer.dropEffect = 'move';
                  if (colunaAlvo !== coluna) setColunaAlvo(coluna);
                }}
                onDragLeave={(evento) => {
                  if (!evento.currentTarget.contains(evento.relatedTarget as Node | null)) {
                    setColunaAlvo(null);
                  }
                }}
                onDrop={(evento) => soltar(evento, coluna)}
                className={cn(
                  'flex min-h-40 flex-col gap-2.5 rounded-xl border border-dashed p-2 transition-colors',
                  fechado ? 'border-(--acento)/35 bg-(--acento-suave)/60' : 'bg-(--papel)',
                  colunaAlvo === coluna && arrastando && 'border-(--acento) bg-(--acento-suave)',
                )}
              >
                {daColuna.map((cartao) => (
                  <article
                    key={cartao.id}
                    draggable
                    onDragStart={(evento) => {
                      evento.dataTransfer.setData('text/plain', cartao.id);
                      evento.dataTransfer.effectAllowed = 'move';
                      setArrastando(cartao.id);
                    }}
                    onDragEnd={() => {
                      setArrastando(null);
                      setColunaAlvo(null);
                    }}
                    className={cn(
                      'group bg-card flex cursor-grab flex-col gap-2 rounded-lg border p-3 shadow-(--sombra-sutil) transition-[box-shadow,opacity,transform] duration-200 active:cursor-grabbing',
                      'hover:shadow-(--sombra-camadas)',
                      arrastando === cartao.id && 'opacity-40',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{cartao.cliente}</p>
                        <p className="text-muted-foreground truncate text-xs">{cartao.servico}</p>
                      </div>
                      <GripVertical
                        aria-hidden
                        className="text-muted-foreground/60 mt-0.5 hidden size-4 shrink-0 lg:block"
                      />
                    </div>

                    {cartao.parado && (
                      <span className="text-atencao bg-atencao-suave inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium">
                        <Clock aria-hidden className="size-3" />
                        Parado há 8 dias
                      </span>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <span className="numerico text-sm font-semibold">{reais(cartao.valor)}</span>

                      <span className="flex gap-1">
                        <BotaoMover
                          direcao="anterior"
                          cliente={cartao.cliente}
                          destino={COLUNAS_FUNIL[indiceColuna - 1]}
                          onMover={(destino) => mover(cartao.id, destino)}
                        />
                        <BotaoMover
                          direcao="proxima"
                          cliente={cartao.cliente}
                          destino={COLUNAS_FUNIL[indiceColuna + 1]}
                          onMover={(destino) => mover(cartao.id, destino)}
                        />
                      </span>
                    </div>
                  </article>
                ))}

                {daColuna.length === 0 && (
                  <p className="text-muted-foreground px-2 py-6 text-center text-xs">
                    Solte um cliente aqui
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <p className="text-muted-foreground border-t px-5 py-3 text-xs leading-relaxed sm:px-6">
        No sistema, o orçamento enviado e o aprovado levam o cliente de etapa sozinhos. Etapas do
        cadastro padrão · dados de exemplo.
      </p>

      <p aria-live="polite" className="sr-only">
        {anuncio}
      </p>
    </div>
  );
}

function Total({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string;
  valor: number;
  destaque?: boolean;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-[0.7rem] font-semibold tracking-[0.14em] uppercase">
        {rotulo}
      </p>
      {/* A `key` refaz o nó a cada valor novo, e a animação `.numero-novo` roda de novo. */}
      <p
        key={valor}
        className={cn(
          'numero-destaque numero-novo mt-1 text-3xl sm:text-4xl',
          destaque && 'text-(--acento)',
        )}
      >
        {reais(valor)}
      </p>
    </div>
  );
}

function BotaoMover({
  direcao,
  cliente,
  destino,
  onMover,
}: {
  direcao: 'anterior' | 'proxima';
  cliente: string;
  destino: ColunaFunil | undefined;
  onMover: (destino: ColunaFunil) => void;
}) {
  const Icone = direcao === 'anterior' ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      disabled={!destino}
      onClick={() => destino && onMover(destino)}
      aria-label={destino ? `Mover ${cliente} para ${destino}` : undefined}
      className="text-muted-foreground hover:text-foreground flex size-7 items-center justify-center rounded-md border hover:border-(--linha-forte) disabled:invisible"
    >
      <Icone aria-hidden className="size-4" />
    </button>
  );
}
