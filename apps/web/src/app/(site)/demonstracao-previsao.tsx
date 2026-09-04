'use client';

import { AlertTriangle, ArrowUpRight, CheckCircle2, Sparkles } from 'lucide-react';
import { useState } from 'react';

const MESES = ['Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago'] as const;
const LARGURA = 660;
const ALTURA = 280;
const MARGEM = { topo: 20, direita: 18, baixo: 34, esquerda: 46 };
const MAXIMO = 100;

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
  const IconeRisco = cenario.risco === 'baixo' ? CheckCircle2 : AlertTriangle;

  return (
    <div className="bg-card overflow-hidden rounded-xl border shadow-[var(--sombra-media)]">
      <div className="bg-superficie flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div>
          <p className="text-sm font-semibold">Previsão inteligente de caixa</p>
          <p className="text-muted-foreground text-xs">6 meses de histórico · 4 projetados</p>
        </div>
        <span className="bg-sucesso-suave text-sucesso flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
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

        <div className="rounded-lg border p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold">Saldo acumulado</p>
            <div className="text-muted-foreground flex items-center gap-3 text-[0.6875rem]">
              <Legenda classe="bg-grafico-2" rotulo="Realizado" />
              <Legenda classe="bg-grafico-1" rotulo="Projetado" />
            </div>
          </div>

          <svg
            viewBox={`0 0 ${LARGURA} ${ALTURA}`}
            role="img"
            aria-label={`Gráfico do cenário ${cenario.rotulo}: saldo projetado de ${cenario.saldo} em agosto`}
            className="h-auto w-full overflow-visible"
          >
            {[0, 25, 50, 75, 100].map((valor) => {
              const y = MARGEM.topo + (ALTURA - MARGEM.topo - MARGEM.baixo) * (1 - valor / MAXIMO);
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
                  <text x="0" y={y + 4} className="fill-muted-foreground text-[10px]">
                    {valor === 0 ? 'R$ 0' : `${valor} mil`}
                  </text>
                </g>
              );
            })}

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
              className="fill-muted-foreground text-[10px]"
            >
              Hoje
            </text>

            <g key={cenarioId}>
              <path d={banda} className="fill-grafico-1/10 grafico-area-animada" />
              <path d={area} className="fill-grafico-1/10 grafico-area-animada" />
              <path
                d={caminho(historico)}
                fill="none"
                className="stroke-grafico-2"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={caminho(projecao)}
                fill="none"
                className="stroke-grafico-1 grafico-linha-animada"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {pontos.map((ponto, indice) => (
                <circle
                  key={MESES[indice]}
                  cx={ponto.x}
                  cy={ponto.y}
                  r="4"
                  className={indice < 3 ? 'fill-grafico-2' : 'fill-grafico-1'}
                >
                  <title>{`${MESES[indice]}: R$ ${cenario.valores[indice]} mil`}</title>
                </circle>
              ))}
            </g>

            {MESES.map((mes, indice) => (
              <text
                key={mes}
                x={pontos[indice]!.x}
                y={ALTURA - 10}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {mes}
              </text>
            ))}
          </svg>
        </div>

        <div className="bg-superficie grid gap-4 rounded-lg border p-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <span className="flex items-center gap-2 text-xs font-semibold">
              <IconeRisco className="text-primary size-4" aria-hidden />
              Risco {cenario.risco}
            </span>
            <p className="mt-1 text-sm font-medium">{cenario.resumo}</p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{cenario.acao}</p>
          </div>
          <ArrowUpRight className="text-primary hidden size-5 sm:block" aria-hidden />
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
      <p className="mt-1 text-lg font-semibold tracking-tight tabular-nums">{valor}</p>
      <p className="text-muted-foreground text-[0.6875rem]">{detalhe}</p>
    </div>
  );
}

function Legenda({ classe, rotulo }: { classe: string; rotulo: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${classe}`} /> {rotulo}
    </span>
  );
}
