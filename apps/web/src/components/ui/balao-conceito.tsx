'use client';

import { ArrowRight, ChevronRight, CircleHelp, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { NOME_DO_OPERADOR } from '@/lib/operadores';
import { cn } from '@/lib/utils';

/**
 * Uma linha da conta "com os seus números".
 *
 * O valor chega **pronto e vindo da API** — o balão só o desenha. Somar ou
 * subtrair aqui criaria uma segunda fonte para um número que já tem dono, e as
 * duas poderiam divergir.
 */
export interface PassoDeConta {
  rotulo: string;
  /** Já formatado pelo chamador (moeda, contagem, percentual). */
  valor: string;
  /** `=` marca o resultado: ganha uma linha acima e peso maior. */
  operador?: '+' | '−' | '÷' | '=';
}

interface Props {
  titulo: string;
  resumo: string;
  comoCalcula?: string;
  comoLer?: string;
  exemplo?: string;
  passos?: PassoDeConta[];
  /** Âncora do conceito no glossário. */
  hrefGlossario: string;
  className?: string;
}

const LARGURA_ESTIMADA_REM = 22;
const MARGEM_DA_TELA = 8;
const ESPACO_ATE_O_BOTAO = 8;

/**
 * Botão "?" que abre uma explicação do conceito ao lado do número.
 *
 * ## Por que o Popover nativo
 *
 * `popover="auto"` entrega, sem JavaScript nosso, o que daria trabalho e
 * erraria nos cantos: fechar com Esc, fechar ao clicar fora, abrir um e fechar o
 * outro, devolver o foco ao botão e desenhar acima de qualquer `overflow` ou
 * `z-index` da página (ele vai para a camada superior). O que sobra para o
 * componente é só **posicionar**.
 *
 * Antes da hidratação o botão já funciona — `popovertarget` é HTML puro. O
 * balão só aparece mal posicionado (centralizado) nesse instante, e nunca deixa
 * de abrir.
 *
 * ## Cuidado: não ponha `display` no balão
 *
 * O navegador esconde o balão fechado com `display: none`. Uma classe como
 * `flex` ou `grid` neste elemento vence essa regra e o balão fica visível o
 * tempo todo. O layout interno mora no `<div>` de dentro.
 *
 * ## Posição
 *
 * Calculada na abertura, a partir do botão, e refeita enquanto a página rola ou
 * a janela muda de tamanho — o balão está em `position: fixed`, e sem isso ele
 * ficaria parado enquanto o número anda. Se o botão sai da tela, o balão fecha.
 */
export function BalaoConceito({
  titulo,
  resumo,
  comoCalcula,
  comoLer,
  exemplo,
  passos,
  hrefGlossario,
  className,
}: Props) {
  const id = useId();
  const botao = useRef<HTMLButtonElement>(null);
  const balao = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const gatilho = botao.current;
    const elemento = balao.current;

    if (!gatilho || !elemento) {
      return;
    }

    function posicionar() {
      if (!gatilho || !elemento) {
        return;
      }

      const caixa = gatilho.getBoundingClientRect();

      if (caixa.bottom < 0 || caixa.top > window.innerHeight) {
        elemento.hidePopover();
        return;
      }

      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const larguraMaxima = window.innerWidth - 2 * MARGEM_DA_TELA;
      // Fechado, o balão não tem medida: a estimativa serve ao primeiro quadro
      // e a medida real corrige no `toggle`, logo em seguida.
      const largura = elemento.offsetWidth || Math.min(LARGURA_ESTIMADA_REM * rem, larguraMaxima);
      const altura = elemento.offsetHeight;

      const centro = caixa.left + caixa.width / 2 - largura / 2;
      const esquerda = Math.min(
        Math.max(centro, MARGEM_DA_TELA),
        window.innerWidth - largura - MARGEM_DA_TELA,
      );

      let topo = caixa.bottom + ESPACO_ATE_O_BOTAO;

      // Sem espaço embaixo, sobe para cima do botão; sem espaço em nenhum dos
      // dois lados, encosta no rodapé e deixa o balão rolar por dentro.
      if (altura > 0 && topo + altura > window.innerHeight - MARGEM_DA_TELA) {
        const acima = caixa.top - ESPACO_ATE_O_BOTAO - altura;
        topo =
          acima >= MARGEM_DA_TELA
            ? acima
            : Math.max(MARGEM_DA_TELA, window.innerHeight - altura - MARGEM_DA_TELA);
      }

      elemento.style.left = `${esquerda}px`;
      elemento.style.top = `${topo}px`;
    }

    function acompanharPagina() {
      // `capture` porque rolagem não borbulha: é a única forma de saber que
      // um contêiner rolável (a tabela, o painel lateral) se mexeu.
      window.addEventListener('scroll', posicionar, true);
      window.addEventListener('resize', posicionar);
    }

    function largarPagina() {
      window.removeEventListener('scroll', posicionar, true);
      window.removeEventListener('resize', posicionar);
    }

    function aoPreparar(evento: Event) {
      if ((evento as ToggleEvent).newState === 'open') {
        posicionar();
      }
    }

    function aoAlternar(evento: Event) {
      if ((evento as ToggleEvent).newState === 'open') {
        acompanharPagina();
        posicionar();
      } else {
        largarPagina();
      }
    }

    elemento.addEventListener('beforetoggle', aoPreparar);
    elemento.addEventListener('toggle', aoAlternar);

    return () => {
      elemento.removeEventListener('beforetoggle', aoPreparar);
      elemento.removeEventListener('toggle', aoAlternar);
      largarPagina();
    };
  }, []);

  return (
    <>
      <button
        ref={botao}
        type="button"
        popoverTarget={id}
        aria-label={`O que é ${titulo}?`}
        title="O que é isto?"
        // A área de toque real é o `after`: o ícone tem 16px, e 16px é pouco
        // para um dedo. O pseudo-elemento estende o alvo sem empurrar o texto.
        className={cn(
          'dica-conceito text-muted-foreground/70 hover:text-foreground relative inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full after:absolute after:-inset-2 after:content-[""]',
          className,
        )}
      >
        <CircleHelp aria-hidden className="size-4" />
      </button>

      <div
        ref={balao}
        id={id}
        popover="auto"
        role="dialog"
        aria-label={titulo}
        // `font-normal`, `tracking-normal`, `whitespace-normal`, `normal-case` e
        // `text-left` blindam o balão contra herança. Ele continua sendo
        // descendente de quem o abriu, mesmo desenhado na camada superior, e
        // herdava o negrito do `<th>`, a caixa-alta dos títulos de indicador e o
        // `nowrap` das células de data.
        className="balao-conceito bg-popover text-popover-foreground m-0 max-h-[min(32rem,calc(100dvh-1rem))] w-[min(22rem,calc(100vw-1rem))] inset-auto overflow-y-auto rounded-lg border p-0 font-normal tracking-normal whitespace-normal normal-case shadow-(--sombra-media) text-left"
      >
        <div className="flex flex-col gap-3 p-4 text-left normal-case">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm leading-snug font-semibold">{titulo}</p>

            <button
              type="button"
              popoverTarget={id}
              popoverTargetAction="hide"
              aria-label="Fechar explicação"
              className="text-muted-foreground hover:text-foreground -m-1 shrink-0 rounded-md p-1"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>

          <p className="text-sm leading-relaxed">{resumo}</p>

          {passos && passos.length > 0 && <ContaComOsSeusNumeros passos={passos} />}

          <div className="flex flex-col divide-y border-y">
            {comoCalcula && (
              <Camada titulo="Como é calculado" aberta>
                {comoCalcula}
              </Camada>
            )}
            {comoLer && <Camada titulo="Como ler este número">{comoLer}</Camada>}
            {exemplo && <Camada titulo="Exemplo">{exemplo}</Camada>}
          </div>

          <Link
            href={hrefGlossario}
            className="text-primary inline-flex w-fit items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
          >
            Ver no glossário
            <ArrowRight aria-hidden className="size-3" />
          </Link>
        </div>
      </div>
    </>
  );
}

/**
 * Uma seção que abre e fecha.
 *
 * `<details>` em vez de estado: já é acessível, funciona por teclado e não pede
 * JavaScript. O balão começa curto — resumo e "como é calculado" — e quem quer
 * mais abre, em vez de todos receberem o texto inteiro de uma vez.
 */
function Camada({
  titulo,
  aberta = false,
  children,
}: {
  titulo: string;
  aberta?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={aberta} className="group py-2">
      <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium select-none [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden
          className="size-3.5 shrink-0 transition-transform group-open:rotate-90"
        />
        {titulo}
      </summary>
      <p className="text-muted-foreground mt-1.5 pl-5 text-xs leading-relaxed">{children}</p>
    </details>
  );
}

/**
 * A conta, com os números da própria empresa.
 *
 * É o que transforma a definição em entendimento: ler "entradas menos saídas"
 * é abstrato, ver `R$ 8.000 − R$ 5.500 = R$ 2.500` com os valores de hoje não é.
 */
function ContaComOsSeusNumeros({ passos }: { passos: PassoDeConta[] }) {
  return (
    <div className="bg-muted/60 rounded-md px-3 py-2.5">
      <p className="text-muted-foreground mb-1.5 text-[0.6875rem] font-semibold tracking-wider uppercase">
        Com os seus números
      </p>

      <dl className="flex flex-col gap-1 text-xs">
        {passos.map((passo) => {
          const resultado = passo.operador === '=';

          return (
            <div
              key={passo.rotulo}
              className={cn(
                'flex items-baseline justify-between gap-3',
                resultado && 'mt-0.5 border-t pt-1.5 text-sm font-semibold',
              )}
            >
              <dt className={cn(!resultado && 'text-muted-foreground')}>
                {passo.operador && (
                  <>
                    <span aria-hidden className="mr-1.5 inline-block w-3 text-center">
                      {passo.operador}
                    </span>
                    <span className="sr-only">{NOME_DO_OPERADOR[passo.operador]} </span>
                  </>
                )}
                {passo.rotulo}
              </dt>
              <dd className="font-medium tabular-nums">{passo.valor}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
