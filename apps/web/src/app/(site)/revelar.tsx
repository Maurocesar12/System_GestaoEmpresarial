'use client';

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';

interface RevelarProps {
  children: ReactNode;
  className?: string;
  atrasoMs?: number;
}

/** Mostra um bloco quando ele entra na tela, sem biblioteca de animação. */
export function Revelar({ children, className = '', atrasoMs = 0 }: RevelarProps) {
  const referencia = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const elemento = referencia.current;
    if (!elemento) return;

    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada?.isIntersecting) return;
        setVisivel(true);
        observador.disconnect();
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );

    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  return (
    <div
      ref={referencia}
      data-visivel={visivel}
      className={`revelar-site ${className}`}
      style={{ '--atraso-revelar': `${atrasoMs}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
