import type { CSSProperties } from 'react';

const COR_PADRAO = '#111111';

export function estilosEtiqueta(cor: string, preenchida = true): CSSProperties {
  const hex = corValida(cor) ? cor : COR_PADRAO;

  if (!preenchida) {
    return {
      backgroundColor: `${hex}18`,
      borderColor: `${hex}66`,
      color: hex,
    };
  }

  return {
    backgroundColor: hex,
    borderColor: hex,
    color: corTextoSobre(hex),
  };
}

function corValida(cor: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(cor);
}

function corTextoSobre(cor: string): '#111111' | '#ffffff' {
  const vermelho = parseInt(cor.slice(1, 3), 16) / 255;
  const verde = parseInt(cor.slice(3, 5), 16) / 255;
  const azul = parseInt(cor.slice(5, 7), 16) / 255;
  const luminancia = 0.2126 * canal(vermelho) + 0.7152 * canal(verde) + 0.0722 * canal(azul);

  return luminancia > 0.56 ? '#111111' : '#ffffff';
}

function canal(valor: number): number {
  return valor <= 0.03928 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4;
}
