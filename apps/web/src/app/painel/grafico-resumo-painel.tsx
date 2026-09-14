'use client';

import { formatarBRL, type BlocoFinanceiro } from '@gestao/shared-types';
import { ArrowDownRight, ArrowUpRight, CircleDollarSign, Minus, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { cn } from '@/lib/utils';

const LARGURA = 820;
const ALTURA = 300;
const MARGEM = { topo: 20, direita: 24, baixo: 46, esquerda: 68 };

const FORMATADOR_COMPACTO = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

type Visao = 'fluxo' | 'acumulado';

interface Ponto {
  mes: string;
  entradas: number;
  saidas: number;
  saldo: number;
  /** Soma dos saldos desde o início da janela — a curva do caixa no período. */
  acumulado: number;
}

/**
 * Resumo financeiro do painel.
 *
 * ## Por que barras, e não três linhas
 *
 * A versão anterior desenhava entradas, saídas e saldo como três linhas
 * sobrepostas. Linha serve para ler **tendência**; a pergunta aqui é de
 * **comparação** — "quanto entrou contra quanto saiu neste mês" —, e comparar
 * comprimento de barra é muito mais rápido que comparar altura de dois pontos
 * em curvas que se cruzam. O saldo, que é tendência de verdade, ganhou a visão
 * própria de acumulado.
 *
 * ## Por que o detalhe fica num painel fixo, e não num balão
 *
 * Balão preso ao cursor não existe no celular e, no computador, tapa justamente
 * a parte do gráfico que a pessoa está olhando. Aqui o mês em foco aparece
 * **sempre no mesmo lugar**, acima do gráfico: o dedo ou o mouse percorrem os
 * meses e só os números trocam. Sem interação nenhuma, ele já abre no mês
 * corrente, que é o que se quer ver ao entrar no sistema.
 *
 * ## Por que o mês corrente aparece marcado
 *
 * Ele está pela metade — comparar 12 dias com meses fechados faz o último mês
 * parecer uma queda. A barra listrada e o rótulo "parcial" evitam a leitura
 * errada sem esconder o dado.
 */
export function GraficoResumoPainel({ serie }: { serie: BlocoFinanceiro['serie'] }) {
  const [visao, setVisao] = useState<Visao>('fluxo');
  const [focado, setFocado] = useState<number | null>(null);

  // O acumulado sai de um `reduce`, e não de um contador atualizado dentro do
  // `map`: reatribuir variável durante a renderização é o tipo de coisa que
  // funciona até o React renderizar duas vezes.
  const pontos = serie.reduce<Ponto[]>((lista, mes) => {
    const saldo = Number(mes.saldo);

    return [
      ...lista,
      {
        mes: mes.mes,
        entradas: Number(mes.entradas),
        saidas: Number(mes.saidas),
        saldo,
        acumulado: (lista.at(-1)?.acumulado ?? 0) + saldo,
      },
    ];
  }, []);

  const totalEntradas = pontos.reduce((soma, ponto) => soma + ponto.entradas, 0);
  const totalSaidas = pontos.reduce((soma, ponto) => soma + ponto.saidas, 0);
  const saldoDoPeriodo = totalEntradas - totalSaidas;
  const temMovimento = pontos.some((ponto) => ponto.entradas > 0 || ponto.saidas > 0);

  // O mês corrente é o último da série e o foco padrão: é o que a pessoa quer
  // ver ao abrir o painel.
  const indiceAtual = Math.max(0, pontos.length - 1);
  const indiceEmFoco = focado ?? indiceAtual;
  const emFoco = pontos[indiceEmFoco];
  const anterior = indiceEmFoco > 0 ? pontos[indiceEmFoco - 1] : undefined;

  // Série vazia só acontece se a API mudar o tamanho da janela para zero. O
  // cartão some em vez de desenhar eixos sem nada dentro.
  if (!emFoco) {
    return null;
  }

  return (
    <Cartao className="overflow-hidden">
      {/*
        O cabeçalho quebra em telas estreitas: sem `flex-wrap`, os três totais
        eram empurrados para fora do cartão no celular e apareciam cortados no
        meio da palavra.
      */}
      <CartaoCabecalho className="bg-muted/35 flex-wrap items-start border-b-0 px-5 py-5">
        <div className="min-w-[12rem] flex-1">
          <CartaoTitulo className="flex items-center gap-2 text-base">
            <TrendingUp aria-hidden className="text-primary size-5" />
            Resumo financeiro
          </CartaoTitulo>
          <p className="text-muted-foreground mt-1 text-sm">
            Os últimos {pontos.length} meses do caixa, mês a mês.
          </p>
        </div>

        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
          <Metrica
            icone={ArrowUpRight}
            rotulo="Entradas"
            valor={totalEntradas}
            tom="text-sucesso"
          />
          <Metrica
            icone={ArrowDownRight}
            rotulo="Saídas"
            valor={totalSaidas}
            tom="text-destructive"
          />
          <Metrica
            icone={CircleDollarSign}
            rotulo="Saldo do período"
            valor={saldoDoPeriodo}
            tom={saldoDoPeriodo < 0 ? 'text-destructive' : 'text-sucesso'}
            destaque
          />
        </div>
      </CartaoCabecalho>

      <CartaoConteudo className="p-0">
        {!temMovimento ? (
          <SemMovimento />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-y px-4 py-3 sm:px-5">
              <div
                role="group"
                aria-label="Visualização do resumo"
                className="bg-muted flex rounded-md p-1"
              >
                {(
                  [
                    ['fluxo', 'Entradas e saídas'],
                    ['acumulado', 'Saldo acumulado'],
                  ] as const
                ).map(([opcao, rotulo]) => (
                  <button
                    key={opcao}
                    type="button"
                    aria-pressed={visao === opcao}
                    onClick={() => setVisao(opcao)}
                    className={cn(
                      'min-h-8 rounded px-3 text-xs font-medium transition-colors',
                      visao === opcao
                        ? 'bg-background text-foreground shadow-[var(--sombra-sutil)]'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>

              <div className="text-muted-foreground flex flex-wrap gap-3 text-[0.6875rem]">
                {visao === 'fluxo' ? (
                  <>
                    <Legenda classe="bg-grafico-1" rotulo="Entradas" />
                    <Legenda classe="bg-grafico-3" rotulo="Saídas" />
                  </>
                ) : (
                  <Legenda classe="bg-grafico-2" rotulo="Saldo acumulado no período" />
                )}
              </div>
            </div>

            <MesEmFoco
              ponto={emFoco}
              anterior={anterior}
              parcial={indiceEmFoco === indiceAtual}
              acompanhandoOCursor={focado !== null}
            />

            <Grafico
              pontos={pontos}
              visao={visao}
              indiceEmFoco={indiceEmFoco}
              indiceAtual={indiceAtual}
              aoFocar={setFocado}
            />

            <Indicadores pontos={pontos} totalEntradas={totalEntradas} />

            <Tabela pontos={pontos} indiceAtual={indiceAtual} />
          </>
        )}
      </CartaoConteudo>
    </Cartao>
  );
}

/**
 * O mês em foco, em quatro números.
 *
 * Fica acima do gráfico e em posição fixa para que percorrer os meses troque só
 * o conteúdo. `aria-live` faz o leitor de tela anunciar a troca quando a pessoa
 * navega pelo teclado — sem isso, a navegação por setas seria silenciosa.
 */
function MesEmFoco({
  ponto,
  anterior,
  parcial,
  acompanhandoOCursor,
}: {
  ponto: Ponto;
  anterior?: Ponto;
  parcial: boolean;
  acompanhandoOCursor: boolean;
}) {
  const variacao = anterior ? ponto.saldo - anterior.saldo : 0;

  return (
    <div
      aria-live="polite"
      className="flex flex-wrap items-baseline gap-x-6 gap-y-2 px-4 py-3 sm:px-5"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold">{formatarMesCompleto(ponto.mes)}</span>
        {parcial && !acompanhandoOCursor && (
          <span className="text-muted-foreground text-xs">em andamento</span>
        )}
        {parcial && acompanhandoOCursor && (
          <span className="text-atencao text-xs font-medium">mês parcial</span>
        )}
      </div>

      <NumeroEmFoco rotulo="Entradas" valor={ponto.entradas} tom="text-sucesso" />
      <NumeroEmFoco rotulo="Saídas" valor={ponto.saidas} tom="text-destructive" />
      <NumeroEmFoco
        rotulo="Saldo do mês"
        valor={ponto.saldo}
        tom={ponto.saldo < 0 ? 'text-destructive' : 'text-foreground'}
      />

      {anterior && (
        <span
          className={cn(
            'flex items-center gap-1 text-xs tabular-nums',
            variacao > 0
              ? 'text-sucesso'
              : variacao < 0
                ? 'text-destructive'
                : 'text-muted-foreground',
          )}
        >
          {variacao > 0 ? (
            <ArrowUpRight aria-hidden className="size-3.5" />
          ) : variacao < 0 ? (
            <ArrowDownRight aria-hidden className="size-3.5" />
          ) : (
            <Minus aria-hidden className="size-3.5" />
          )}
          {formatarBRL(Math.abs(variacao).toFixed(2))} vs. {formatarMesCurto(anterior.mes)}
        </span>
      )}
    </div>
  );
}

function NumeroEmFoco({ rotulo, valor, tom }: { rotulo: string; valor: number; tom: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-muted-foreground text-[0.6875rem]">{rotulo}</span>
      <span className={cn('text-sm font-semibold tabular-nums', tom)}>
        {formatarBRL(valor.toFixed(2))}
      </span>
    </div>
  );
}

/**
 * O desenho.
 *
 * Cada mês tem uma faixa invisível que captura ponteiro e toque — é ela, e não
 * as barras, que recebe a interação: acertar uma barra de 20px com o dedo é
 * difícil, acertar a coluna inteira não. As setas do teclado percorrem os meses
 * pelo contêiner focável.
 */
function Grafico({
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
function Barra({
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

/**
 * As três leituras que o gráfico sozinho não dá.
 *
 * "Sobra de cada real" é a que mais muda decisão: fatura alto e sobra 4% é um
 * negócio diferente de faturar metade e sobrar 30%, e nenhum dos dois aparece
 * na altura das barras.
 */
function Indicadores({ pontos, totalEntradas }: { pontos: Ponto[]; totalEntradas: number }) {
  // Os meses fechados são a base da comparação: o corrente está pela metade e
  // entraria como "pior mês" em todo dia 2.
  const fechados = pontos.slice(0, -1);
  const base = fechados.length > 0 ? fechados : pontos;
  const primeiro = base[0];

  if (!primeiro) {
    return null;
  }

  const melhor = base.reduce(
    (maior, ponto) => (ponto.saldo > maior.saldo ? ponto : maior),
    primeiro,
  );
  const negativos = base.filter((ponto) => ponto.saldo < 0).length;
  const saldoTotal = pontos.reduce((soma, ponto) => soma + ponto.saldo, 0);
  const sobra = totalEntradas > 0 ? saldoTotal / totalEntradas : 0;

  return (
    <div className="bg-muted/20 grid gap-3 border-t p-4 sm:grid-cols-3 sm:px-5">
      <Insight
        rotulo="Melhor mês"
        valor={formatarBRL(melhor.saldo.toFixed(2))}
        detalhe={`${formatarMesCompleto(melhor.mes)}${fechados.length > 0 ? '' : ' (em andamento)'}`}
        tom={melhor.saldo < 0 ? 'text-destructive' : 'text-sucesso'}
      />
      <Insight
        rotulo="Sobra de cada real que entra"
        valor={`${Math.round(sobra * 100)}%`}
        detalhe="Saldo do período sobre as entradas"
        tom={sobra < 0 ? 'text-destructive' : sobra < 0.1 ? 'text-atencao' : 'text-sucesso'}
      />
      <Insight
        rotulo="Meses no vermelho"
        valor={`${negativos} de ${base.length}`}
        detalhe={
          negativos === 0 ? 'Nenhum mês fechou negativo' : 'Meses em que saiu mais do que entrou'
        }
        tom={negativos > 0 ? 'text-destructive' : 'text-foreground'}
      />
    </div>
  );
}

/**
 * Os números exatos, para quem precisa deles.
 *
 * Gráfico nenhum permite ler valor com precisão, e leitor de tela nenhum lê
 * barra. A tabela resolve os dois — fechada por padrão, para não competir com o
 * desenho.
 */
function Tabela({ pontos, indiceAtual }: { pontos: Ponto[]; indiceAtual: number }) {
  return (
    <details className="border-t">
      <summary className="hover:bg-accent/40 cursor-pointer px-4 py-3 text-sm font-medium transition-colors sm:px-5">
        Ver números mês a mês
      </summary>

      <div className="overflow-x-auto border-t">
        <table className="w-full min-w-[32rem] text-sm">
          <caption className="sr-only">
            Entradas, saídas, saldo e saldo acumulado dos últimos {pontos.length} meses
          </caption>
          <thead className="bg-muted/50 text-muted-foreground border-b text-left text-xs">
            <tr>
              <th className="px-4 py-2.5 font-medium">Mês</th>
              <th className="px-4 py-2.5 text-right font-medium">Entradas</th>
              <th className="px-4 py-2.5 text-right font-medium">Saídas</th>
              <th className="px-4 py-2.5 text-right font-medium">Saldo</th>
              <th className="px-4 py-2.5 text-right font-medium">Acumulado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pontos.map((ponto, indice) => (
              <tr key={ponto.mes}>
                <td className="px-4 py-2.5">
                  {formatarMesCompleto(ponto.mes)}
                  {indice === indiceAtual && (
                    <span className="text-muted-foreground text-xs"> · parcial</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatarBRL(ponto.entradas.toFixed(2))}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatarBRL(ponto.saidas.toFixed(2))}
                </td>
                <td
                  className={cn(
                    'px-4 py-2.5 text-right font-medium tabular-nums',
                    ponto.saldo < 0 && 'text-destructive',
                  )}
                >
                  {formatarBRL(ponto.saldo.toFixed(2))}
                </td>
                <td
                  className={cn(
                    'px-4 py-2.5 text-right tabular-nums',
                    ponto.acumulado < 0 && 'text-destructive',
                  )}
                >
                  {formatarBRL(ponto.acumulado.toFixed(2))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function SemMovimento() {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
      <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-full">
        <CircleDollarSign aria-hidden className="size-5" />
      </span>
      <div>
        <p className="text-sm font-semibold">Resumo aguardando movimentação</p>
        <p className="text-muted-foreground mt-1 max-w-md text-sm">
          Assim que houver lançamentos pagos, o painel mostra a evolução de entradas, saídas e saldo
          mês a mês.
        </p>
      </div>
    </div>
  );
}

function Metrica({
  icone: Icone,
  rotulo,
  valor,
  tom,
  destaque = false,
}: {
  icone: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  rotulo: string;
  valor: number;
  tom: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={cn(
        'bg-card min-w-[7.5rem] flex-1 rounded-md border px-3 py-2 shadow-[var(--sombra-sutil)] sm:flex-none sm:min-w-[9rem]',
        destaque && 'border-primary/35',
      )}
    >
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Icone aria-hidden className="size-3.5" />
        {rotulo}
      </div>
      <p className={cn('mt-1 text-sm font-semibold tabular-nums', tom)}>
        {formatarBRL(valor.toFixed(2))}
      </p>
    </div>
  );
}

function Insight({
  rotulo,
  valor,
  detalhe,
  tom,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  tom: string;
}) {
  return (
    <div className="bg-card rounded-md border px-3 py-2">
      <p className="text-muted-foreground text-xs">{rotulo}</p>
      <p className={cn('mt-1 text-sm font-semibold tabular-nums', tom)}>{valor}</p>
      <p className="text-muted-foreground mt-0.5 text-xs">{detalhe}</p>
    </div>
  );
}

function Legenda({ classe, rotulo }: { classe: string; rotulo: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('size-2 rounded-full', classe)} />
      {rotulo}
    </span>
  );
}

function formatarMesCurto(mes: string): string {
  return new Date(`${mes}-01T12:00:00Z`).toLocaleDateString('pt-BR', {
    month: 'short',
    timeZone: 'UTC',
  });
}

/**
 * "setembro de 2026" com a inicial maiúscula — e só ela.
 *
 * A classe `capitalize` do CSS levantaria também o "de", produzindo "Setembro
 * De 2026". Fazer no texto resolve nos três lugares que mostram o mês por
 * extenso, sem regra de estilo em cada um.
 */
function formatarMesCompleto(mes: string): string {
  const texto = new Date(`${mes}-01T12:00:00Z`).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
