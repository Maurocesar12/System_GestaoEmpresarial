'use client';

import { useState } from 'react';
import type { MesProjetado } from '@gestao/shared-types';

const LARGURA = 760;
const ALTURA = 300;
const MARGEM = { topo: 18, direita: 20, baixo: 42, esquerda: 64 };

const FORMATADOR_COMPACTO = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function GraficoFluxoProjetado({ projecoes }: { projecoes: MesProjetado[] }) {
  const [visao, setVisao] = useState<'saldo' | 'fluxo'>('saldo');
  if (projecoes.length === 0) return null;

  const dados = projecoes.map((item) => ({
    mes: item.mes,
    entradas: Number(item.entradas),
    saidas: Number(item.saidas),
    saldoAcumulado: Number(item.saldoAcumulado),
  }));
  const valores = dados.flatMap((item) =>
    visao === 'saldo' ? [item.saldoAcumulado, 0] : [item.entradas, item.saidas, 0],
  );
  const minimoBruto = Math.min(...valores);
  const maximoBruto = Math.max(...valores);
  const folga = Math.max((maximoBruto - minimoBruto) * 0.12, 1);
  const minimo = minimoBruto < 0 ? minimoBruto - folga : 0;
  const maximo = maximoBruto + folga;
  const larguraUtil = LARGURA - MARGEM.esquerda - MARGEM.direita;
  const alturaUtil = ALTURA - MARGEM.topo - MARGEM.baixo;
  const larguraGrupo = larguraUtil / dados.length;
  const larguraBarra = Math.min(26, larguraGrupo * 0.24);
  const y = (valor: number) =>
    MARGEM.topo + alturaUtil * (1 - (valor - minimo) / (maximo - minimo));
  const yZero = y(0);
  const linha = dados
    .map((item, indice) => {
      const x = MARGEM.esquerda + larguraGrupo * (indice + 0.5);
      return `${indice === 0 ? 'M' : 'L'} ${x} ${y(item.saldoAcumulado)}`;
    })
    .join(' ');
  const marcacoes = Array.from(
    { length: 5 },
    (_, indice) => minimo + ((maximo - minimo) * indice) / 4,
  );

  return (
    <div className="border-b p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Visualização da previsão" className="flex rounded-md bg-muted p-1">
          {(['saldo', 'fluxo'] as const).map((opcao) => (
            <button key={opcao} type="button" aria-pressed={visao === opcao}
              onClick={() => setVisao(opcao)}
              className={`min-h-9 rounded px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ${visao === opcao ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              {opcao === 'saldo' ? 'Saldo acumulado' : 'Entradas e saídas'}
            </button>
          ))}
        </div>
        <div className="text-muted-foreground flex flex-wrap gap-3 text-[0.6875rem]">
          {visao === 'fluxo' ? <>
            <Legenda classe="bg-foreground" rotulo="Entradas" />
            <Legenda classe="bg-zinc-300" rotulo="Saídas" />
          </> : <Legenda classe="bg-foreground" rotulo="Saldo projetado" linha />}
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${LARGURA} ${ALTURA}`}
          role="img"
          aria-label={visao === 'saldo' ? 'Saldo acumulado projetado por mês' : 'Entradas e saídas projetadas por mês'}
          className="w-full min-w-[32rem]"
        >
          {marcacoes.map((valor) => {
            const posicaoY = y(valor);
            return (
              <g key={valor}>
                <line
                  x1={MARGEM.esquerda}
                  x2={LARGURA - MARGEM.direita}
                  y1={posicaoY}
                  y2={posicaoY}
                  className="stroke-border"
                />
                <text
                  x={MARGEM.esquerda - 8}
                  y={posicaoY + 4}
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px]"
                >
                  {FORMATADOR_COMPACTO.format(valor)}
                </text>
              </g>
            );
          })}

          <line
            x1={MARGEM.esquerda}
            x2={LARGURA - MARGEM.direita}
            y1={yZero}
            y2={yZero}
            className="stroke-muted-foreground/50"
            strokeWidth="1.25"
          />

          {dados.map((item, indice) => {
            const centro = MARGEM.esquerda + larguraGrupo * (indice + 0.5);
            return (
              <g key={item.mes}>
                {visao === 'fluxo' && <><Barra
                  x={centro - larguraBarra - 2}
                  yZero={yZero}
                  yValor={y(item.entradas)}
                  largura={larguraBarra}
                  classe="fill-foreground"
                  titulo={`Entradas: ${FORMATADOR_COMPACTO.format(item.entradas)}`}
                />
                <Barra
                  x={centro + 2}
                  yZero={yZero}
                  yValor={y(item.saidas)}
                  largura={larguraBarra}
                  classe="fill-zinc-300"
                  titulo={`Saídas: ${FORMATADOR_COMPACTO.format(item.saidas)}`}
                /></>}
                <text
                  x={centro}
                  y={ALTURA - 14}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px] capitalize"
                >
                  {formatarMes(item.mes)}
                </text>
              </g>
            );
          })}

          {visao === 'saldo' && <><path
            d={`${linha} L ${MARGEM.esquerda + larguraGrupo * (dados.length - 0.5)} ${yZero} L ${MARGEM.esquerda + larguraGrupo * 0.5} ${yZero} Z`}
            className="fill-foreground/5"
          /><path
            d={linha}
            fill="none"
            className="stroke-foreground"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {dados.map((item, indice) => {
            const x = MARGEM.esquerda + larguraGrupo * (indice + 0.5);
            return (
              <circle
                key={item.mes}
                cx={x}
                cy={y(item.saldoAcumulado)}
                r="4"
                className="fill-background stroke-foreground"
                strokeWidth="2"
              >
                <title>Saldo acumulado: {FORMATADOR_COMPACTO.format(item.saldoAcumulado)}</title>
              </circle>
            );
          })}</>}
        </svg>
      </div>
    </div>
  );
}

function Barra({
  x,
  yZero,
  yValor,
  largura,
  classe,
  titulo,
}: {
  x: number;
  yZero: number;
  yValor: number;
  largura: number;
  classe: string;
  titulo: string;
}) {
  return (
    <rect
      x={x}
      y={Math.min(yZero, yValor)}
      width={largura}
      height={Math.max(1, Math.abs(yZero - yValor))}
      rx="3"
      className={`${classe} grafico-barra-animada`}
      style={{ transformOrigin: `${x + largura / 2}px ${yZero}px` }}
    >
      <title>{titulo}</title>
    </rect>
  );
}

function Legenda({
  classe,
  rotulo,
  linha = false,
}: {
  classe: string;
  rotulo: string;
  linha?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`${linha ? 'h-0.5 w-3 rounded-full' : 'size-2 rounded-sm'} ${classe}`} />
      {rotulo}
    </span>
  );
}

function formatarMes(mes: string): string {
  return new Date(`${mes}-01T12:00:00Z`).toLocaleDateString('pt-BR', {
    month: 'short',
    timeZone: 'UTC',
  });
}
