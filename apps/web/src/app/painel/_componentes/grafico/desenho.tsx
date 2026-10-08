'use client';

import { cn } from '@/lib/utils';
import {
  type Ponto,
  type Visao,
  LARGURA,
  MARGEM,
  ALTURA,
  FORMATADOR_COMPACTO,
  formatarMesCurto,
} from './comum';

/** O desenho do gráfico do painel, em SVG. */

/**
 * O desenho.
 *
 * Cada mês tem uma faixa invisível que captura ponteiro e toque — é ela, e não
 * as barras, que recebe a interação: acertar uma barra de 20px com o dedo é
 * difícil, acertar a coluna inteira não. As setas do teclado percorrem os meses
 * pelo contêiner focável.
 */
export function Grafico({
  pontos,
  visao,
  indiceEmFoco,
  indiceAtual,
  aoFocar,
}: {
  pontos: Ponto[];
  visao: Visao;
  indiceEmFoco: number;
  indiceAtual: number;
  aoFocar: (indice: number | null) => void;
}) {
  const valores = pontos.flatMap((ponto) =>
    visao === 'fluxo' ? [ponto.entradas, ponto.saidas, 0] : [ponto.acumulado, 0],
  );
  const minimoBruto = Math.min(...valores);
  const maximoBruto = Math.max(...valores);
  const folga = Math.max((maximoBruto - minimoBruto) * 0.14, 1);
  const minimo = minimoBruto < 0 ? minimoBruto - folga : 0;
  const maximo = maximoBruto + folga;

  const larguraUtil = LARGURA - MARGEM.esquerda - MARGEM.direita;
  const alturaUtil = ALTURA - MARGEM.topo - MARGEM.baixo;
  const larguraGrupo = larguraUtil / pontos.length;
  const larguraBarra = Math.min(28, larguraGrupo * 0.3);

  const centro = (indice: number) => MARGEM.esquerda + larguraGrupo * (indice + 0.5);
  const y = (valor: number) =>
    MARGEM.topo + alturaUtil * (1 - (valor - minimo) / (maximo - minimo));
  const yZero = y(0);
  const marcacoes = Array.from(
    { length: 5 },
    (_, indice) => minimo + ((maximo - minimo) * indice) / 4,
  );

  const linhaAcumulada = pontos
    .map((ponto, indice) => `${indice === 0 ? 'M' : 'L'} ${centro(indice)} ${y(ponto.acumulado)}`)
    .join(' ');

  const areaAcumulada = `${linhaAcumulada} L ${centro(pontos.length - 1)} ${yZero} L ${centro(0)} ${yZero} Z`;

  function navegar(evento: React.KeyboardEvent<HTMLDivElement>): void {
    const passo = evento.key === 'ArrowRight' ? 1 : evento.key === 'ArrowLeft' ? -1 : 0;
    if (passo === 0) return;

    evento.preventDefault();
    aoFocar(Math.min(pontos.length - 1, Math.max(0, indiceEmFoco + passo)));
  }

  return (
    <div
      tabIndex={0}
      role="group"
      aria-label={`Gráfico do resumo financeiro. Use as setas para percorrer os ${pontos.length} meses.`}
      onKeyDown={navegar}
      // Só o mouse devolve o foco ao mês corrente ao sair. No toque, o
      // `pointerleave` dispara junto com o dedo saindo da tela — o mês
      // escolhido piscaria e sumiria antes de a pessoa ler os números.
      onPointerLeave={(evento) => {
        if (evento.pointerType === 'mouse') aoFocar(null);
      }}
      className="focus-visible:ring-ring overflow-x-auto px-4 pb-5 focus-visible:ring-2 focus-visible:outline-none sm:px-5"
    >
      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        role="img"
        aria-label={
          visao === 'fluxo'
            ? 'Entradas e saídas mês a mês'
            : 'Saldo acumulado do período, mês a mês'
        }
        className="w-full min-w-[34rem]"
      >
        <defs>
          <linearGradient id="area-acumulado-painel" x1="0" x2="0" y1="0" y2="1">
            <stop
              offset="0%"
              className="text-grafico-2"
              stopColor="currentColor"
              stopOpacity="0.25"
            />
            <stop
              offset="100%"
              className="text-grafico-2"
              stopColor="currentColor"
              stopOpacity="0"
            />
          </linearGradient>

          {/* Listras para o mês que ainda não fechou. */}
          <pattern
            id="parcial-painel"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" fill="currentColor" fillOpacity="0.25" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="3" />
          </pattern>
        </defs>

        {marcacoes.map((valor) => (
          <g key={valor}>
            <line
              x1={MARGEM.esquerda}
              x2={LARGURA - MARGEM.direita}
              y1={y(valor)}
              y2={y(valor)}
              className="stroke-border"
            />
            <text
              x={MARGEM.esquerda - 10}
              y={y(valor) + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[10px]"
            >
              {FORMATADOR_COMPACTO.format(valor)}
            </text>
          </g>
        ))}

        {minimo < 0 && (
          <line
            x1={MARGEM.esquerda}
            x2={LARGURA - MARGEM.direita}
            y1={yZero}
            y2={yZero}
            className="stroke-muted-foreground/60"
            strokeWidth="1.25"
          />
        )}

        {/* A coluna do mês em foco, atrás de tudo. */}
        <rect
          x={MARGEM.esquerda + larguraGrupo * indiceEmFoco}
          y={MARGEM.topo}
          width={larguraGrupo}
          height={alturaUtil}
          rx="6"
          className="fill-accent/60"
        />

        {visao === 'fluxo'
          ? pontos.map((ponto, indice) => (
              <g key={ponto.mes}>
                {/*
                  `text-*` e não `fill-*`: a barra e as listras do mês parcial
                  pintam com `currentColor`, que lê a propriedade `color`. Com
                  `fill-*`, a listra herdaria o preto padrão — foi o que
                  aconteceu na primeira versão.
                */}
                <Barra
                  x={centro(indice) - larguraBarra - 2}
                  largura={larguraBarra}
                  valor={ponto.entradas}
                  y={y}
                  yZero={yZero}
                  classe="text-grafico-1"
                  parcial={indice === indiceAtual}
                />
                <Barra
                  x={centro(indice) + 2}
                  largura={larguraBarra}
                  valor={ponto.saidas}
                  y={y}
                  yZero={yZero}
                  classe="text-grafico-3"
                  parcial={indice === indiceAtual}
                />
              </g>
            ))
          : null}

        {visao === 'acumulado' && (
          <>
            <path
              d={areaAcumulada}
              className="grafico-area-animada"
              fill="url(#area-acumulado-painel)"
            />
            <path
              d={linhaAcumulada}
              fill="none"
              className="stroke-grafico-2 grafico-linha-animada"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {pontos.map((ponto, indice) => (
              <circle
                key={ponto.mes}
                cx={centro(indice)}
                cy={y(ponto.acumulado)}
                r={indice === indiceEmFoco ? 6 : 3.5}
                className={cn(
                  'fill-grafico-2',
                  indice === indiceEmFoco && 'fill-card stroke-grafico-2',
                )}
                strokeWidth="3"
              />
            ))}
          </>
        )}

        {pontos.map((ponto, indice) => (
          <text
            key={`rotulo-${ponto.mes}`}
            x={centro(indice)}
            y={ALTURA - 16}
            textAnchor="middle"
            className={cn(
              'text-[10px]',
              indice === indiceEmFoco ? 'fill-foreground font-semibold' : 'fill-muted-foreground',
            )}
          >
            {formatarMesCurto(ponto.mes)}
            {indice === indiceAtual && (
              <tspan className="fill-muted-foreground text-[9px]"> · parcial</tspan>
            )}
          </text>
        ))}

        {/*
          As faixas de captura ficam por último para receberem o ponteiro antes
          de qualquer outra coisa — e são invisíveis de propósito: o destaque de
          quem está em foco já é a coluna pintada atrás das barras.
        */}
        {pontos.map((ponto, indice) => (
          <rect
            key={`faixa-${ponto.mes}`}
            x={MARGEM.esquerda + larguraGrupo * indice}
            y={MARGEM.topo}
            width={larguraGrupo}
            height={alturaUtil}
            fill="transparent"
            aria-hidden
            onPointerEnter={() => aoFocar(indice)}
            onPointerDown={() => aoFocar(indice)}
          />
        ))}
      </svg>
    </div>
  );
}

/**
 * Uma barra que sai do zero.
 *
 * Desenhada a partir do eixo, e não do topo do gráfico: é isso que faz um mês
 * com saída maior que entrada continuar legível quando a escala tem valores
 * negativos.
 */
export function Barra({
  x,
  largura,
  valor,
  y,
  yZero,
  classe,
  parcial,
}: {
  x: number;
  largura: number;
  valor: number;
  y: (valor: number) => number;
  yZero: number;
  classe: string;
  parcial: boolean;
}) {
  const topo = Math.min(y(valor), yZero);
  const altura = Math.abs(yZero - y(valor));

  return (
    <g className={classe}>
      <rect
        x={x}
        y={topo}
        width={largura}
        height={Math.max(altura, valor === 0 ? 0 : 1.5)}
        rx="3"
        className={cn('grafico-barra-animada', parcial && 'opacity-70')}
        style={{ transformOrigin: `${x}px ${yZero}px` }}
        fill="currentColor"
      />
      {parcial && altura > 4 && (
        <rect
          x={x}
          y={topo}
          width={largura}
          height={altura}
          rx="3"
          fill="url(#parcial-painel)"
          opacity="0.5"
        />
      )}
    </g>
  );
}
