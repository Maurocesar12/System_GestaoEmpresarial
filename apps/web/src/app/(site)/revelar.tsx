import type { CSSProperties, ReactNode } from 'react';

/**
 * Mostra um bloco quando ele entra na tela.
 *
 * Era um componente de cliente com `IntersectionObserver`: JavaScript baixado,
 * hidratado e executado numa página de marketing, para fazer o que a própria
 * rolagem já sabe fazer. Agora é `animation-timeline: view()` — o navegador
 * liga a animação à posição do elemento na viewport, sem observador, sem
 * estado e **sem JavaScript nenhum**.
 *
 * Onde a animação por rolagem não existe (Safari e Firefox, hoje), a regra
 * `@supports` do `globals.css` deixa o bloco visível desde o início: o texto
 * de uma landing page nunca pode depender de animação para aparecer.
 */
export function Revelar({
  children,
  className = '',
  atrasoMs = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Atraso relativo, para blocos vizinhos não subirem exatamente juntos. */
  atrasoMs?: number;
}) {
  return (
    <div
      className={`revelar-site ${className}`}
      style={{ '--atraso-revelar': `${atrasoMs}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
