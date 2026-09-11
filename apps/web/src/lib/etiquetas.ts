import type { CSSProperties } from 'react';

const COR_PADRAO = '#111111';

export const PALETA_ETIQUETAS = [
  { nome: 'Urgente', cor: '#DC2626' },
  { nome: 'Quente', cor: '#F97316' },
  { nome: 'Prioridade', cor: '#D97706' },
  { nome: 'Aguardando', cor: '#A16207' },
  { nome: 'Retorno', cor: '#0F766E' },
  { nome: 'Contrato', cor: '#7C3AED' },
  { nome: 'Fechamento', cor: '#059669' },
  { nome: 'VIP', cor: '#111827' },
  { nome: 'Frio', cor: '#475569' },
  { nome: 'Especial', cor: '#A21CAF' },
] as const;

export function estilosEtiqueta(cor: string, preenchida = true): CSSProperties {
  const hex = normalizarHex(cor);

  if (!preenchida) {
    return {
      backgroundColor: hexComAlfa(hex, 0.13),
      borderColor: hexComAlfa(hex, 0.42),
      color: corTextoEmSuperficie(hex),
      boxShadow: `inset 0 -1px ${hexComAlfa(hex, 0.12)}`,
    };
  }

  return {
    backgroundColor: hex,
    borderColor: misturarHex(hex, '#111111', 0.18),
    color: corTextoSobre(hex),
    boxShadow: `inset 0 -1px ${hexComAlfa('#000000', 0.18)}, 0 1px 2px ${hexComAlfa(hex, 0.3)}`,
  };
}

export function estilosCartaoComEtiqueta(cor?: string): CSSProperties {
  if (!cor || !corValida(cor)) return {};

  const hex = normalizarHex(cor);

  return {
    borderColor: hexComAlfa(hex, 0.42),
    backgroundImage: `linear-gradient(180deg, ${hexComAlfa(hex, 0.1)} 0%, transparent 52%)`,
    boxShadow: `0 10px 24px -18px ${hexComAlfa(hex, 0.8)}, var(--sombra-sutil)`,
  };
}

export function estilosMarcadorEtiqueta(cor?: string): CSSProperties {
  if (!cor || !corValida(cor)) return {};

  const hex = normalizarHex(cor);

  return {
    backgroundColor: hex,
    boxShadow: `0 0 0 3px ${hexComAlfa(hex, 0.14)}`,
  };
}

export function estilosAvatarEtiqueta(cor?: string): CSSProperties {
  if (!cor || !corValida(cor)) return {};

  const hex = normalizarHex(cor);

  return {
    backgroundColor: hexComAlfa(hex, 0.14),
    color: corTextoEmSuperficie(hex),
    boxShadow: `inset 0 0 0 1px ${hexComAlfa(hex, 0.22)}`,
  };
}

function corValida(cor: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(cor);
}

function normalizarHex(cor: string): string {
  return corValida(cor) ? cor.toUpperCase() : COR_PADRAO;
}

function corTextoSobre(cor: string): '#111111' | '#ffffff' {
  const vermelho = parseInt(cor.slice(1, 3), 16) / 255;
  const verde = parseInt(cor.slice(3, 5), 16) / 255;
  const azul = parseInt(cor.slice(5, 7), 16) / 255;
  const luminancia = 0.2126 * canal(vermelho) + 0.7152 * canal(verde) + 0.0722 * canal(azul);

  return luminancia > 0.56 ? '#111111' : '#ffffff';
}

function corTextoEmSuperficie(cor: string): string {
  return corTextoSobre(cor) === '#111111' ? misturarHex(cor, '#111111', 0.58) : cor;
}

function canal(valor: number): number {
  return valor <= 0.03928 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4;
}

function hexComAlfa(cor: string, alfa: number): string {
  const canalAlfa = Math.round(Math.min(1, Math.max(0, alfa)) * 255);

  return `${normalizarHex(cor)}${canalAlfa.toString(16).padStart(2, '0').toUpperCase()}`;
}

function misturarHex(cor: string, alvo: string, pesoAlvo: number): string {
  const origem = paraRgb(normalizarHex(cor));
  const destino = paraRgb(normalizarHex(alvo));
  const peso = Math.min(1, Math.max(0, pesoAlvo));

  return `#${[0, 1, 2]
    .map((indice) => Math.round(origem[indice]! * (1 - peso) + destino[indice]! * peso))
    .map((valor) => valor.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

function paraRgb(cor: string): [number, number, number] {
  return [
    parseInt(cor.slice(1, 3), 16),
    parseInt(cor.slice(3, 5), 16),
    parseInt(cor.slice(5, 7), 16),
  ];
}
