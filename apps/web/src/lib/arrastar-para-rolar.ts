'use client';

import { useRef, type PointerEvent as EventoDePonteiro } from 'react';

/**
 * Elementos que **não** iniciam o arrasto do container.
 *
 * Clicar num botão, num link ou num seletor precisa continuar fazendo o que
 * sempre fez. Sem esta lista, segurar o mouse sobre "Avançar" e tremer a mão
 * arrastaria o quadro em vez de mover o cartão.
 *
 * `[data-cartao]` cobre o cartão inteiro, não só seus controles: quem pega um
 * cartão pela borda quer mover o cartão, e o dnd-kit é que deve cuidar disso.
 */
const SELETOR_INTERATIVO =
  'a, button, select, input, textarea, [role="button"], [data-cartao], [data-sem-arrasto]';

/**
 * Arrastar o container para rolá-lo na horizontal, como se empurrasse o quadro.
 *
 * ## Por que existe
 *
 * A barra de rolagem do sistema é propositalmente discreta — o que deixa o site
 * limpo, mas também deixa o quadro do funil parecendo que não rola. Com cinco
 * ou seis etapas, a pessoa não encontra o caminho para as colunas da direita.
 *
 * Aqui o próprio fundo do quadro vira a alça: pegar um espaço vazio, o cabeçalho
 * de uma coluna ou a área entre cartões e puxar para o lado move o quadro. A
 * barra de rolagem continua funcionando normalmente, e a roda do mouse também.
 *
 * ## O toque fica de fora, de propósito
 *
 * No celular o dedo já rola o quadro nativamente, com inércia e o efeito de
 * borda do sistema. Interceptar isso só pioraria: perderíamos a inércia para
 * reimplementá-la pior. O hook ignora `pointerType === 'touch'` e devolve o
 * gesto ao navegador.
 *
 * ## Como usar
 *
 * ```tsx
 * const rolagem = useArrastarParaRolar<HTMLDivElement>();
 * <div {...rolagem} className="overflow-x-auto">
 * ```
 *
 * Não devolve `ref`: os manipuladores ficam presos ao próprio elemento, então
 * `evento.currentTarget` já **é** o container que se quer rolar.
 */
export function useArrastarParaRolar<T extends HTMLElement>() {
  /**
   * O gesto em andamento. Fica em `ref`, e não em estado, porque muda a cada
   * pixel movido: em estado, o quadro inteiro re-renderizaria dezenas de vezes
   * por arrasto — com trinta cartões na tela, o arrasto engasgaria.
   */
  const gesto = useRef<{ ponteiro: number; x: number; rolagemInicial: number } | null>(null);

  function aoPressionar(evento: EventoDePonteiro<T>) {
    const elemento = evento.currentTarget;

    // Só o botão principal. O do meio é colagem no Linux e o da direita abre o
    // menu de contexto — nenhum dos dois deve arrastar nada.
    if (evento.button !== 0 || evento.pointerType === 'touch') return;

    if ((evento.target as HTMLElement).closest(SELETOR_INTERATIVO)) return;

    // Nada a rolar: sem esta checagem o cursor viraria "agarrando" num quadro
    // que não sai do lugar, prometendo algo que não acontece.
    if (elemento.scrollWidth <= elemento.clientWidth) return;

    // A barra de rolagem é do navegador, não nossa.
    //
    // Ela faz parte do elemento, então um clique nela chega aqui como um clique
    // qualquer — e aí o arrasto do navegador e o nosso puxariam o quadro ao
    // mesmo tempo, em disputa. `clientHeight` não conta a barra e a altura da
    // caixa conta: a faixa entre as duas é exatamente onde ela está.
    const caixa = elemento.getBoundingClientRect();
    if (evento.clientY - caixa.top > elemento.clientHeight) return;

    gesto.current = {
      ponteiro: evento.pointerId,
      x: evento.clientX,
      rolagemInicial: elemento.scrollLeft,
    };

    // A captura garante que o arrasto continue mesmo se o cursor sair do
    // quadro — sem ela, puxar até a borda da janela soltaria o gesto no meio.
    elemento.setPointerCapture(evento.pointerId);
    elemento.classList.add('cursor-grabbing', 'select-none');
  }

  function aoMover(evento: EventoDePonteiro<T>) {
    const atual = gesto.current;
    if (atual?.ponteiro !== evento.pointerId) return;

    // Sinal invertido: arrastar para a esquerda avança o conteúdo para a
    // direita, que é como se empurra um objeto físico.
    evento.currentTarget.scrollLeft = atual.rolagemInicial - (evento.clientX - atual.x);
  }

  function aoEncerrar(evento: EventoDePonteiro<T>) {
    if (gesto.current?.ponteiro !== evento.pointerId) return;

    const elemento = evento.currentTarget;
    gesto.current = null;

    if (elemento.hasPointerCapture(evento.pointerId)) {
      elemento.releasePointerCapture(evento.pointerId);
    }

    elemento.classList.remove('cursor-grabbing', 'select-none');
  }

  return {
    onPointerDown: aoPressionar,
    onPointerMove: aoMover,
    onPointerUp: aoEncerrar,
    // `onPointerCancel` cobre o caso em que o sistema toma o ponteiro de volta
    // (troca de janela, gesto do sistema operacional). Sem ele o quadro ficaria
    // preso no estado "arrastando" até o próximo clique.
    onPointerCancel: aoEncerrar,
  };
}
