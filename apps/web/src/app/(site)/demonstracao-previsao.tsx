'use client';

import { AlertTriangle, ArrowUpRight, CheckCircle2, Sparkles } from 'lucide-react';
import { useState } from 'react';

const MESES = ['Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago'] as const;
const LARGURA = 660;
const ALTURA = 280;
const MARGEM = { topo: 20, direita: 18, baixo: 34, esquerda: 46 };
const MAXIMO = 100;
const COR_REALIZADO = 'var(--muted-foreground)';
const COR_PROJETADO = 'var(--foreground)';
const FORMATADOR_BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const CENARIOS = {
  conservador: {
    rotulo: 'Conservador',
    valores: [38, 43, 48, 42, 36, 31, 28.4],
    saldo: 'R$ 28,4 mil',
    variacao: '−41% no período projetado',
    risco: 'moderado',
    resumo: 'As contas previstas pressionam o caixa a partir de junho.',
    acao: 'Antecipar recebíveis e revisar despesas recorrentes antes de junho.',
  },
  realista: {
    rotulo: 'Realista',
    valores: [38, 43, 48, 51, 55, 61, 68.4],
    saldo: 'R$ 68,4 mil',
    variacao: '+42% no período projetado',
    risco: 'baixo',
    resumo: 'O caixa cresce com folga, mesmo considerando as contas já registradas.',
    acao: 'Manter a reserva e acompanhar os recebimentos maiores de julho.',
  },
  otimista: {
    rotulo: 'Otimista',
    valores: [38, 43, 48, 56, 67, 82, 96],
    saldo: 'R$ 96 mil',
    variacao: '+100% no período projetado',
    risco: 'baixo',
    resumo: 'A conversão de propostas abertas acelera a formação de caixa.',
    acao: 'Planejar capacidade da equipe para atender o crescimento sem perder margem.',
  },
} as const;

type CenarioId = keyof typeof CENARIOS;
type Cenario = (typeof CENARIOS)[CenarioId];

const FORMULAS = [
  {
    titulo: 'Saldo futuro',
    formula: 'saldo + entradas - saidas',
  },
  {
    titulo: 'Confiança',
    formula: 'historico x recorrencia',
  },
  {
    titulo: 'Risco',
    formula: 'atrasos + contas abertas',
  },
] as const;

function coordenadas(valores: readonly number[]) {
  const larguraUtil = LARGURA - MARGEM.esquerda - MARGEM.direita;
  const alturaUtil = ALTURA - MARGEM.topo - MARGEM.baixo;

  return valores.map((valor, indice) => ({
    x: MARGEM.esquerda + (larguraUtil * indice) / (valores.length - 1),
    y: MARGEM.topo + alturaUtil * (1 - valor / MAXIMO),
  }));
}

function caminho(pontos: ReturnType<typeof coordenadas>) {
  return pontos
    .map((ponto, indice) => `${indice === 0 ? 'M' : 'L'} ${ponto.x} ${ponto.y}`)
    .join(' ');
}

export function DemonstracaoPrevisao() {
  const [cenarioId, setCenarioId] = useState<CenarioId>('realista');
  const cenario = CENARIOS[cenarioId];
  const pontos = coordenadas(cenario.valores);
  const historico = pontos.slice(0, 3);
  const projecao = pontos.slice(2);
  const base = ALTURA - MARGEM.baixo;
  const area = `${caminho(projecao)} L ${projecao.at(-1)?.x} ${base} L ${projecao[0]?.x} ${base} Z`;
  const bandaSuperior = coordenadas(
    cenario.valores.map((valor) => Math.min(MAXIMO, valor * 1.1)),
  ).slice(2);
  const bandaInferior = coordenadas(cenario.valores.map((valor) => valor * 0.9))
    .slice(2)
    .reverse();
  const banda = `${caminho(bandaSuperior)} ${bandaInferior.map((ponto) => `L ${ponto.x} ${ponto.y}`).join(' ')} Z`;
  const profundidade = 10;
  const caminhoElevado = caminho(
    pontos.map((ponto) => ({ x: ponto.x + profundidade, y: ponto.y + profundidade })),
  );
  const IconeRisco = cenario.risco === 'baixo' ? CheckCircle2 : AlertTriangle;
  const saldoAtual = cenario.valores[2]!;
  const saldoProjetado = cenario.valores.at(-1)!;
  const crescimentoProjetado = saldoProjetado - saldoAtual;

  return (
    <div className="bg-card overflow-hidden rounded-xl border shadow-[var(--sombra-media)]">
      <div className="bg-superficie flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div>
          <p className="text-sm font-semibold">Previsão inteligente de caixa</p>
          <p className="text-muted-foreground text-xs">6 meses de histórico · 4 projetados</p>
        </div>
        <span className="bg-accent text-foreground flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
          <Sparkles className="size-3.5" aria-hidden /> Análise concluída
        </span>
      </div>

      <div className="flex flex-col gap-5 p-4 sm:p-5">
        <div className="flex flex-wrap gap-2" aria-label="Escolha um cenário de previsão">
          {(Object.keys(CENARIOS) as CenarioId[]).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={cenarioId === id}
              onClick={() => setCenarioId(id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                cenarioId === id
                  ? 'bg-foreground text-background border-foreground shadow-sm'
                  : 'bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >
              {CENARIOS[id].rotulo}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Indicador rotulo="Saldo em agosto" valor={cenario.saldo} detalhe={cenario.variacao} />
          <Indicador rotulo="Contas consideradas" valor="47" detalhe="a pagar e a receber" />
          <Indicador rotulo="Confiança da análise" valor="Alta" detalhe="histórico consistente" />
        </div>

        <div id="saldo-acumulado" className="scroll-mt-20 rounded-lg border p-3 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold">Saldo acumulado</p>
            <div className="text-muted-foreground flex items-center gap-3 text-[0.6875rem]">
              <Legenda cor={COR_REALIZADO} rotulo="Realizado" />
              <Legenda cor={COR_PROJETADO} rotulo="Projetado" />
            </div>
          </div>

          <svg
            viewBox={`0 0 ${LARGURA} ${ALTURA}`}
            role="img"
            aria-label={`Gráfico do cenário ${cenario.rotulo}: saldo projetado de ${cenario.saldo} em agosto`}
            className="h-auto w-full overflow-visible"
          >
              <defs>
                <linearGradient id="area-projetada" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="var(--foreground)" stopOpacity="0.2" />
                  <stop offset="1" stopColor="var(--foreground)" stopOpacity="0.025" />
                </linearGradient>
                <linearGradient id="base-3d" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="var(--foreground)" stopOpacity="0.18" />
                  <stop offset="1" stopColor="var(--foreground)" stopOpacity="0.04" />
                </linearGradient>
                <filter id="sombra-grafico" x="-20%" y="-20%" width="150%" height="160%">
                  <feDropShadow dx="0" dy="7" stdDeviation="5" floodColor="#000" floodOpacity="0.28" />
                </filter>
              </defs>

              {[0, 25, 50, 75, 100].map((valor) => {
                const y =
                  MARGEM.topo + (ALTURA - MARGEM.topo - MARGEM.baixo) * (1 - valor / MAXIMO);
                return (
                  <g key={valor}>
                    <line
                      x1={MARGEM.esquerda}
                      x2={LARGURA - MARGEM.direita}
                      y1={y}
                      y2={y}
                      className="stroke-border"
                      strokeWidth="1"
                    />
                    <text x="0" y={y + 4} className="fill-muted-foreground text-[15px] sm:text-[10px]">
                      {valor === 0 ? 'R$ 0' : `R$ ${valor} mil`}
                    </text>
                  </g>
                );
              })}

              {pontos.map((ponto, indice) => (
                <line
                  key={`grade-${MESES[indice]}`}
                  x1={ponto.x}
                  x2={ponto.x}
                  y1={MARGEM.topo}
                  y2={base}
                  className="stroke-border/45"
                  strokeWidth="1"
                />
              ))}

              <polygon
                points={`${MARGEM.esquerda},${base} ${LARGURA - MARGEM.direita},${base} ${LARGURA - MARGEM.direita + profundidade},${base + profundidade} ${MARGEM.esquerda + profundidade},${base + profundidade}`}
                fill="url(#base-3d)"
              />
              <polyline
                points={`${MARGEM.esquerda},${base} ${MARGEM.esquerda + profundidade},${base + profundidade} ${LARGURA - MARGEM.direita + profundidade},${base + profundidade}`}
                fill="none"
                className="stroke-foreground/15"
                strokeWidth="1"
              />

              <line
                x1={(pontos[2]!.x + pontos[3]!.x) / 2}
                x2={(pontos[2]!.x + pontos[3]!.x) / 2}
                y1={MARGEM.topo}
                y2={base}
                className="stroke-muted-foreground/35"
                strokeDasharray="4 5"
              />
              <text
                x={(pontos[2]!.x + pontos[3]!.x) / 2 + 7}
                y={MARGEM.topo + 11}
                className="fill-muted-foreground text-[15px] sm:text-[10px]"
              >
                Hoje
              </text>

              <g key={cenarioId}>
                <path
                  d={caminhoElevado}
                  fill="none"
                  stroke="var(--foreground)"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.12"
                />
                <path d={banda} className="fill-foreground/5 grafico-area-animada" />
                <path d={area} fill="url(#area-projetada)" className="grafico-area-animada" />
                <path
                  d={caminho(historico)}
                  fill="none"
                  stroke={COR_REALIZADO}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#sombra-grafico)"
                />
                <path
                  d={caminho(projecao)}
                  fill="none"
                  stroke={COR_PROJETADO}
                  className="grafico-linha-animada"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#sombra-grafico)"
                />
                {pontos.map((ponto, indice) => (
                  <g key={MESES[indice]}>
                    <circle
                      cx={ponto.x + 3}
                      cy={ponto.y + 5}
                      r="5"
                      fill="var(--foreground)"
                      opacity="0.16"
                    />
                    <circle
                      cx={ponto.x}
                      cy={ponto.y}
                      r="4.5"
                      fill={indice < 3 ? COR_REALIZADO : COR_PROJETADO}
                      stroke="var(--background)"
                      strokeWidth="1.5"
                    >
                      <title>{`${MESES[indice]}: R$ ${cenario.valores[indice]} mil`}</title>
                    </circle>
                  </g>
                ))}
                <g filter="url(#sombra-grafico)">
                  <rect
                    x={pontos.at(-1)!.x - 91}
                    y={pontos.at(-1)!.y - 31}
                    width="91"
                    height="23"
                    rx="5"
                    className="fill-foreground"
                  />
                  <text
                    x={pontos.at(-1)!.x - 8}
                    y={pontos.at(-1)!.y - 16}
                    textAnchor="end"
                    className="fill-background text-[15px] font-semibold sm:text-[10px]"
                  >
                    {cenario.saldo}
                  </text>
                </g>
              </g>

              {MESES.map((mes, indice) => (
                <text
                  key={mes}
                  x={pontos[indice]!.x}
                  y={ALTURA - 10}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[15px] sm:text-[10px]"
                >
                  {mes}
                </text>
              ))}
          </svg>

          <div className="mt-3 grid grid-cols-3 border-t pt-3">
            <DetalheGrafico rotulo="Saldo hoje" valor={FORMATADOR_BRL.format(saldoAtual * 1000)} />
            <DetalheGrafico rotulo="Projeção" valor={FORMATADOR_BRL.format(saldoProjetado * 1000)} />
            <DetalheGrafico
              rotulo="Evolução"
              valor={`${crescimentoProjetado >= 0 ? '+' : ''}${FORMATADOR_BRL.format(crescimentoProjetado * 1000)}`}
            />
          </div>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
          <PainelFormula3D cenario={cenario} />

          <div className="bg-superficie rounded-lg border p-4">
            <div>
              <span className="flex items-center gap-2 text-xs font-semibold">
                <IconeRisco className="text-primary size-4" aria-hidden />
                Risco {cenario.risco}
              </span>
              <p className="mt-2 text-sm font-medium">{cenario.resumo}</p>
              <p className="text-muted-foreground mt-2 text-xs leading-relaxed">{cenario.acao}</p>
            </div>
            <div className="mt-5 flex items-center justify-between border-t pt-3 text-xs font-medium">
              <span>Ver análise completa</span>
              <ArrowUpRight className="text-primary size-4" aria-hidden />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Indicador({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-[0.625rem] font-medium tracking-wide uppercase">
        {rotulo}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{valor}</p>
      <p className="text-muted-foreground text-[0.6875rem]">{detalhe}</p>
    </div>
  );
}

function PainelFormula3D({ cenario }: { cenario: Cenario }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div>
        <p className="text-xs font-semibold">Motor de fórmulas IA</p>
        <p className="text-muted-foreground mt-1 text-[0.6875rem] leading-relaxed">
          O sistema cruza caixa, recorrência e compromissos para montar o cenário {cenario.rotulo.toLowerCase()}.
        </p>
      </div>

      <div className="relative mt-4 h-[178px] overflow-hidden rounded-lg border bg-superficie [perspective:800px]">
        <div className="absolute inset-x-5 bottom-[-48px] h-[170px] border bg-background shadow-[0_28px_45px_rgb(0_0_0_/_0.16)] [transform:rotateX(62deg)_rotateZ(-7deg)] [transform-style:preserve-3d]">
          <div className="absolute inset-0 grid grid-cols-6 grid-rows-5 opacity-60">
            {Array.from({ length: 30 }).map((_, indice) => (
              <span key={indice} className="border-r border-b border-border" />
            ))}
          </div>
        </div>

        <div className="absolute inset-x-4 bottom-4 top-4 grid grid-cols-3 items-end gap-3 [transform-style:preserve-3d]">
          {FORMULAS.map((item, indice) => (
            <div key={item.titulo} className="relative flex h-full flex-col justify-end">
              <div
                className="mx-auto w-[58%] border border-foreground/10 bg-foreground shadow-[8px_12px_20px_rgb(0_0_0_/_0.2)] [transform:skewY(-8deg)]"
                style={{ height: `${54 + indice * 23}px`, opacity: 0.48 + indice * 0.22 }}
              />
              <div className="relative mt-3 border-t border-border pt-2 text-center">
                <span className="text-muted-foreground block text-[0.5625rem] font-semibold uppercase">
                  {item.titulo}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="absolute left-3 top-3 rounded-md border bg-card/90 px-2 py-1 text-[0.625rem] font-medium shadow-sm backdrop-blur-sm">
          Projeção em camadas
        </div>
      </div>

      <div className="mt-3 grid gap-1.5">
        {FORMULAS.map((item, indice) => (
          <div key={item.titulo} className="flex items-center justify-between gap-3 border-b py-1.5 last:border-0">
            <span className="text-muted-foreground text-[0.625rem]">0{indice + 1}</span>
            <code className="text-right text-[0.6875rem] text-foreground">{item.formula}</code>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3 text-[0.6875rem] text-muted-foreground">
        <span>Resultado do cenário</span>
        <strong className="text-foreground">{cenario.saldo}</strong>
      </div>
    </div>
  );
}

function DetalheGrafico({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0 border-r px-2 first:pl-0 last:border-0 last:pr-0">
      <p className="text-muted-foreground text-[0.5625rem] font-medium uppercase">{rotulo}</p>
      <p className="mt-1 truncate text-xs font-semibold tabular-nums" title={valor}>
        {valor}
      </p>
    </div>
  );
}

function Legenda({ cor, rotulo }: { cor: string; rotulo: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2 rounded-full" style={{ background: cor }} /> {rotulo}
    </span>
  );
}
