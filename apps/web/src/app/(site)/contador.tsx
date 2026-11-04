'use client';

import { useEffect, useState } from 'react';

/**
 * Um valor em reais que "conta" até o número final ao carregar.
 *
 * O HTML do servidor já traz o valor final: sem JavaScript, ou com movimento
 * reduzido, é ele que aparece — o número nunca depende da animação para
 * existir. A contagem só começa no primeiro quadro depois da hidratação, e o
 * mockup em volta entra com um esmaecimento (`.entrada`), o que esconde a troca
 * do valor final pelo zero inicial.
 *
 * Todo `setState` acontece dentro do `requestAnimationFrame`, nunca direto no
 * efeito.
 */
export function Contador({
  valor,
  duracaoMs = 1400,
  atrasoMs = 250,
}: {
  valor: number;
  duracaoMs?: number;
  atrasoMs?: number;
}) {
  const [atual, setAtual] = useState(valor);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    let inicio: number | undefined;
    let quadro = 0;

    const passo = (agora: number) => {
      inicio ??= agora + atrasoMs;
      const progresso = Math.min(1, Math.max(0, (agora - inicio) / duracaoMs));
      // Sai rápido e desacelera no fim, como um odômetro parando.
      const suavizado = 1 - Math.pow(1 - progresso, 3);

      setAtual(Math.round(valor * suavizado));

      if (progresso < 1) {
        quadro = requestAnimationFrame(passo);
      }
    };

    quadro = requestAnimationFrame(passo);

    return () => cancelAnimationFrame(quadro);
  }, [valor, duracaoMs, atrasoMs]);

  return <span className="numerico">R$ {atual.toLocaleString('pt-BR')}</span>;
}
