import { Sparkles } from 'lucide-react';
import { CONTA_DO_EXEMPLO, JORNADA, reais, resumirContaDoExemplo } from './conteudo';

/**
 * Um serviço de ponta a ponta, contado ao rolar.
 *
 * Uma linha do tempo vertical: cada etapa diz o que **você** faz e, em
 * destaque, o que **o sistema** faz sozinho — que é o argumento de venda. As
 * etapas "acendem" ao cruzar o meio da tela e a linha se desenha com a
 * rolagem (`.etapa-jornada` e `.linha-jornada`, no `site.css`), sem JavaScript.
 * Onde o navegador não anima por rolagem, tudo aparece aceso desde o início.
 *
 * É uma lista ordenada de verdade (`<ol>`): para o leitor de tela a ordem das
 * etapas é parte do sentido.
 */
export function Jornada() {
  return (
    <ol className="relative mt-14 flex flex-col gap-12 sm:gap-16">
      {/* O trilho, e por cima dele a linha que se desenha. */}
      <span
        aria-hidden
        className="absolute top-2 bottom-2 left-[1.1875rem] w-px bg-(--linha) sm:left-[1.4375rem]"
      />
      <span
        aria-hidden
        className="linha-jornada absolute top-2 bottom-2 left-[1.1875rem] w-px bg-(--acento) sm:left-[1.4375rem]"
      />

      {JORNADA.map((etapa, indice) => (
        <li
          key={etapa.etapa}
          className="etapa-jornada relative grid grid-cols-[2.5rem_1fr] gap-5 sm:grid-cols-[3rem_1fr] sm:gap-8"
        >
          <span
            aria-hidden
            className="numero-destaque relative z-10 flex size-10 items-center justify-center rounded-full border border-(--acento)/40 bg-(--papel) text-lg text-(--acento) sm:size-12 sm:text-xl"
          >
            {indice + 1}
          </span>

          <div className="flex flex-col gap-5 pt-1">
            <div>
              <p className="rotulo">{etapa.etapa}</p>
              <h3 className="display mt-2 text-2xl sm:text-3xl">{etapa.titulo}</h3>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border bg-(--cartao-site) p-4 sm:p-5">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Você faz
                </p>
                <p className="mt-2 text-[0.95rem] leading-relaxed">{etapa.voceFaz}</p>
              </div>

              <div className="rounded-xl border border-(--acento)/30 bg-(--acento-suave) p-4 sm:p-5">
                <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-(--acento) uppercase">
                  <Sparkles aria-hidden className="size-3.5" />O sistema faz sozinho
                </p>
                <p className="mt-2 text-[0.95rem] leading-relaxed">{etapa.sistemaFaz}</p>
              </div>
            </div>

            {etapa.mostraConta && <ContaDaSobra />}
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * A conta, linha a linha: receita, menos cada custo, igual a sobra. Os valores
 * saem de `CONTA_DO_EXEMPLO`; a sobra e o percentual são calculados.
 */
function ContaDaSobra() {
  const conta = resumirContaDoExemplo();

  return (
    <div className="cartao max-w-xl p-5 sm:p-6">
      <p className="text-sm font-semibold">{CONTA_DO_EXEMPLO.servico}</p>

      <dl className="mt-4 flex flex-col gap-2.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt>Recebido</dt>
          <dd className="numerico font-medium">{reais(CONTA_DO_EXEMPLO.receita)}</dd>
        </div>
        {CONTA_DO_EXEMPLO.custos.map((custo) => (
          <div key={custo.rotulo} className="text-muted-foreground flex justify-between gap-4">
            <dt>− {custo.rotulo}</dt>
            <dd className="numerico shrink-0">{reais(custo.valor)}</dd>
          </div>
        ))}
        <div className="mt-1 flex items-baseline justify-between gap-4 border-t pt-3">
          <dt className="font-semibold">Sobra</dt>
          <dd className="numero-destaque text-2xl text-(--acento)">{reais(conta.sobra)}</dd>
        </div>
      </dl>

      <p className="text-muted-foreground mt-3 text-sm">
        De cada R$ 100 recebidos, R$ {conta.percentual} ficaram com você. Para todos os serviços,
        lado a lado.
      </p>
    </div>
  );
}
