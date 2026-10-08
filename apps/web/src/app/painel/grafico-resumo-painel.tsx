'use client';

import { type BlocoFinanceiro } from '@gestao/shared-types';
import { ArrowDownRight, ArrowUpRight, CircleDollarSign, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { cn } from '@/lib/utils';
import { Visao, Ponto } from './_componentes/grafico/comum';
import { Grafico } from './_componentes/grafico/desenho';
import {
  MesEmFoco,
  Indicadores,
  Tabela,
  SemMovimento,
  Metrica,
  Legenda,
} from './_componentes/grafico/detalhes';

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
export function GraficoResumoPainel({
  serie,
  resumo,
}: {
  serie: BlocoFinanceiro['serie'];
  /** Totais e leituras do período, calculados pela API. */
  resumo: BlocoFinanceiro['resumoSerie'];
}) {
  const [visao, setVisao] = useState<Visao>('fluxo');
  const [focado, setFocado] = useState<number | null>(null);

  // Só a conversão para desenhar: valores, saldo e acumulado vêm da API.
  const pontos: Ponto[] = serie.map((mes) => ({
    mes: mes.mes,
    entradas: Number(mes.entradas),
    saidas: Number(mes.saidas),
    saldo: Number(mes.saldo),
    acumulado: Number(mes.acumulado),
    variacaoSaldo: mes.variacaoSaldo,
  }));

  const totalEntradas = Number(resumo.totalEntradas);
  const totalSaidas = Number(resumo.totalSaidas);
  const saldoDoPeriodo = Number(resumo.saldoDoPeriodo);
  const { temMovimento } = resumo;

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
                        ? 'bg-background text-foreground shadow-(--sombra-sutil)'
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

            <Indicadores resumo={resumo} />

            <Tabela pontos={pontos} indiceAtual={indiceAtual} />
          </>
        )}
      </CartaoConteudo>
    </Cartao>
  );
}
