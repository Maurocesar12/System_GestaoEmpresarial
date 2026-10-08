'use client';

import { formatarBRL, type BlocoFinanceiro } from '@gestao/shared-types';
import { ArrowDownRight, ArrowUpRight, CircleDollarSign, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Ponto, formatarMesCompleto, formatarMesCurto } from './comum';

/** As leituras em volta do gráfico do painel: mês em foco, indicadores, tabela. */

/**
 * O mês em foco, em quatro números.
 *
 * Fica acima do gráfico e em posição fixa para que percorrer os meses troque só
 * o conteúdo. `aria-live` faz o leitor de tela anunciar a troca quando a pessoa
 * navega pelo teclado — sem isso, a navegação por setas seria silenciosa.
 */
export function MesEmFoco({
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
  // A diferença vem pronta da API; aqui só se lê o sinal para escolher a cor.
  const variacao = Number(ponto.variacaoSaldo ?? 0);

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
          {formatarBRL((ponto.variacaoSaldo ?? '0').replace('-', ''))} vs.{' '}
          {formatarMesCurto(anterior.mes)}
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
 * As três leituras que o gráfico sozinho não dá.
 *
 * "Sobra de cada real" é a que mais muda decisão: fatura alto e sobra 4% é um
 * negócio diferente de faturar metade e sobrar 30%, e nenhum dos dois aparece
 * na altura das barras.
 */
export function Indicadores({ resumo }: { resumo: BlocoFinanceiro['resumoSerie'] }) {
  const { melhorMes, mesesNegativos, mesesComparados, sobraPorReal, faixaSobra } = resumo;

  if (!melhorMes) {
    return null;
  }

  return (
    <div className="bg-muted/20 grid gap-3 border-t p-4 sm:grid-cols-3 sm:px-5">
      <Insight
        rotulo="Melhor mês"
        valor={formatarBRL(melhorMes.saldo)}
        detalhe={`${formatarMesCompleto(melhorMes.mes)}${melhorMes.emAndamento ? ' (em andamento)' : ''}`}
        tom={melhorMes.saldo.startsWith('-') ? 'text-destructive' : 'text-sucesso'}
      />
      <Insight
        rotulo="Sobra de cada real que entra"
        valor={`${Math.round(sobraPorReal * 100)}%`}
        detalhe="Saldo do período sobre as entradas"
        tom={
          faixaSobra === 'negativa'
            ? 'text-destructive'
            : faixaSobra === 'baixa'
              ? 'text-atencao'
              : 'text-sucesso'
        }
      />
      <Insight
        rotulo="Meses no vermelho"
        valor={`${mesesNegativos} de ${mesesComparados}`}
        detalhe={
          mesesNegativos === 0
            ? 'Nenhum mês fechou negativo'
            : 'Meses em que saiu mais do que entrou'
        }
        tom={mesesNegativos > 0 ? 'text-destructive' : 'text-foreground'}
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
export function Tabela({ pontos, indiceAtual }: { pontos: Ponto[]; indiceAtual: number }) {
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

export function SemMovimento() {
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

export function Metrica({
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
        'bg-card min-w-[7.5rem] flex-1 rounded-md border px-3 py-2 shadow-(--sombra-sutil) sm:flex-none sm:min-w-[9rem]',
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

export function Legenda({ classe, rotulo }: { classe: string; rotulo: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('size-2 rounded-full', classe)} />
      {rotulo}
    </span>
  );
}
