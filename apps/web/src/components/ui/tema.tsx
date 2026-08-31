'use client';

import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';
import { CHAVE_TEMA, TEMAS, type Tema } from '@/lib/tema';
import { cn } from '@/lib/utils';

/**
 * Alternador de tema claro/escuro.
 *
 * São três opções, e não duas: "sistema" é o padrão e respeita a preferência
 * que a pessoa já configurou no computador — trocar isso por um interruptor de
 * dois estados obriga cada usuário a reconfigurar aqui o que já decidiu lá.
 *
 * A escolha vive no `localStorage`, e não em cookie ou no servidor: é
 * preferência de aparência daquele navegador, não dado da conta.
 *
 * O `localStorage` é uma fonte de dados de fora do React, e por isso é lido com
 * `useSyncExternalStore` em vez de `useState` + `useEffect`. Além de ser o
 * mecanismo próprio para isso, é ele que resolve a hidratação: o React usa o
 * valor do servidor para casar a marcação inicial e só então lê o valor real do
 * navegador, sem acusar diferença.
 */

/** Quem precisa ser avisado quando o tema muda nesta aba. */
const ouvintes = new Set<() => void>();

function assinar(aoMudar: () => void): () => void {
  ouvintes.add(aoMudar);

  // `storage` cobre a troca feita em **outra** aba; o evento não dispara na aba
  // que escreveu, e é para essa que existe o conjunto de ouvintes acima.
  window.addEventListener('storage', aoMudar);

  return () => {
    ouvintes.delete(aoMudar);
    window.removeEventListener('storage', aoMudar);
  };
}

function lerEscolha(): Tema {
  try {
    const salvo = localStorage.getItem(CHAVE_TEMA) as Tema | null;

    return salvo && TEMAS.includes(salvo) ? salvo : 'sistema';
  } catch {
    // Navegador com armazenamento bloqueado.
    return 'sistema';
  }
}

/** No servidor não há navegador para consultar; "sistema" é o padrão. */
function lerNoServidor(): Tema {
  return 'sistema';
}

function aplicar(tema: Tema): void {
  const escuro =
    tema === 'escuro' ||
    (tema === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  document.documentElement.classList.toggle('dark', escuro);
}

const OPCOES: { valor: Tema; rotulo: string; icone: LucideIcon }[] = [
  { valor: 'claro', rotulo: 'Tema claro', icone: Sun },
  { valor: 'escuro', rotulo: 'Tema escuro', icone: Moon },
  { valor: 'sistema', rotulo: 'Seguir o sistema', icone: Monitor },
];

export function AlternadorTema() {
  const tema = useSyncExternalStore(assinar, lerEscolha, lerNoServidor);

  // Quem está em "sistema" acompanha a mudança em tempo real: se a pessoa troca
  // o tema do computador com o site aberto, a tela acompanha. O efeito só
  // conversa com o DOM — não altera estado do React.
  useEffect(() => {
    if (tema !== 'sistema') return;

    const consulta = window.matchMedia('(prefers-color-scheme: dark)');
    const aoMudar = () => aplicar('sistema');

    consulta.addEventListener('change', aoMudar);
    return () => consulta.removeEventListener('change', aoMudar);
  }, [tema]);

  function escolher(novo: Tema): void {
    localStorage.setItem(CHAVE_TEMA, novo);
    aplicar(novo);
    ouvintes.forEach((avisar) => avisar());
  }

  return (
    <div
      className="bg-muted inline-flex items-center gap-0.5 rounded-md p-0.5"
      role="group"
      aria-label="Aparência"
    >
      {OPCOES.map(({ valor, rotulo, icone: Icone }) => {
        const ativo = tema === valor;

        return (
          <button
            key={valor}
            type="button"
            onClick={() => escolher(valor)}
            aria-label={rotulo}
            // `aria-pressed` é o que comunica o estado a quem usa leitor de
            // tela; a cor de fundo só serve a quem enxerga.
            aria-pressed={ativo}
            title={rotulo}
            className={cn(
              'flex size-7 items-center justify-center rounded transition-colors',
              ativo
                ? 'bg-card text-foreground shadow-[var(--sombra-sutil)]'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icone aria-hidden className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
