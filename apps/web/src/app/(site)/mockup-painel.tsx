import { ArrowRight, CalendarClock, CircleCheck, TrendingUp } from 'lucide-react';
import type { CSSProperties } from 'react';
import { PercentualMargem } from '@/components/ui/percentual-margem';
import { AGENDA_DE_HOJE, CARTOES_FUNIL, reais, resumirMes, totaisDoFunil } from './conteudo';
import { Contador } from './contador';

/**
 * O painel do sistema, desenhado em código para o hero.
 *
 * Não é print nem ilustração genérica: é a mesma informação que o painel
 * inicial mostra (sobra do mês, margem por serviço, negociações, agenda), com
 * dados de exemplo que fecham entre si — os totais de negociação são os do
 * funil interativo mais abaixo, e a instalação tem a margem da jornada da Maria.
 *
 * `aria-hidden`: o título e o subtítulo ao lado já dizem em texto o que este
 * quadro mostra em forma, e um leitor de tela lendo números de exemplo só
 * atrapalharia.
 */
export function MockupPainel() {
  const mes = resumirMes();
  const funil = totaisDoFunil(CARTOES_FUNIL);

  return (
    <div aria-hidden className="relative">
      <div
        className="cartao entrada overflow-hidden"
        style={{ '--atraso': '120ms' } as CSSProperties}
      >
        {/* Barra de janela: situa o mockup como uma tela do produto. */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-(--linha-forte)" />
            <span className="size-2.5 rounded-full bg-(--linha-forte)" />
            <span className="size-2.5 rounded-full bg-(--linha-forte)" />
          </span>
          <span className="text-muted-foreground text-xs font-medium">Painel · este mês</span>
        </div>

        <div className="grid gap-px bg-(--linha) sm:grid-cols-[1.25fr_1fr]">
          {/* Sobra do mês e margem por serviço. */}
          <div className="bg-card flex flex-col gap-5 p-5 sm:p-6">
            <div>
              <p className="text-muted-foreground text-[0.7rem] font-semibold tracking-[0.14em] uppercase">
                Sobra do mês
              </p>
              <p className="numero-destaque mt-1 text-4xl text-(--acento) sm:text-[2.75rem]">
                <Contador valor={mes.sobra} />
              </p>
              <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
                <TrendingUp className="size-3.5 text-(--acento)" />
                de {reais(mes.recebido)} recebidos, depois dos custos
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold">Margem por serviço</p>
              {mes.servicos.map((servico, indice) => (
                <div key={servico.nome} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-xs sm:w-36">{servico.nome}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="barra block h-full rounded-full bg-(--acento)"
                      style={
                        {
                          width: `${servico.margem}%`,
                          '--atraso': `${400 + indice * 140}ms`,
                        } as CSSProperties
                      }
                    />
                  </span>
                  <span className="w-9 shrink-0 text-right text-xs">
                    <PercentualMargem percentual={servico.margem} />
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Negociações e agenda. */}
          <div className="bg-card flex flex-col gap-4 p-5 sm:p-6">
            <div className="grid grid-cols-2 gap-3">
              <Indicador rotulo="Em negociação" valor={funil.emNegociacao} />
              <Indicador rotulo="Fechado no mês" valor={funil.fechado} destaque />
            </div>

            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold">
                <CalendarClock className="size-3.5" />
                Agenda de hoje
              </p>
              {AGENDA_DE_HOJE.map((item) => (
                <div
                  key={item.hora}
                  className="flex items-center gap-3 rounded-lg border bg-(--papel) px-3 py-2"
                >
                  <span className="numerico text-xs font-semibold text-(--acento)">
                    {item.hora}
                  </span>
                  <span className="min-w-0 truncate text-xs">
                    {item.servico} · <span className="text-muted-foreground">{item.cliente}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-muted-foreground border-t px-4 py-2.5 text-center text-[0.7rem]">
          Calculado sozinho pelo sistema · dados de exemplo
        </p>
      </div>

      {/*
        Cartão flutuante: a automação do funil em uma linha. Só em telas largas,
        sobre o canto vazio da barra de janela, onde não cobre número nem texto.
      */}
      <div
        className="entrada absolute -top-6 -right-5 hidden items-center gap-2.5 rounded-xl border bg-(--cartao-site)/85 px-4 py-3 text-xs shadow-(--sombra-flutuante) backdrop-blur-md lg:flex"
        style={{ '--atraso': '700ms' } as CSSProperties}
      >
        <CircleCheck className="size-4 text-(--acento)" />
        <span>
          Orçamento aprovado: <strong className="font-semibold">Maria Souza</strong>
        </span>
        <ArrowRight className="text-muted-foreground size-3.5" />
        <span className="font-semibold">Fechado</span>
      </div>
    </div>
  );
}

function Indicador({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string;
  valor: number;
  destaque?: boolean;
}) {
  return (
    <div
      className={
        destaque
          ? 'rounded-lg border border-(--acento)/25 bg-(--acento-suave) p-3'
          : 'rounded-lg border bg-(--papel) p-3'
      }
    >
      <p className="text-muted-foreground text-[0.65rem] font-semibold tracking-wide uppercase">
        {rotulo}
      </p>
      <p className="numerico mt-1 text-base font-semibold">{reais(valor)}</p>
    </div>
  );
}
