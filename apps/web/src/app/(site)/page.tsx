import type { Metadata } from 'next';
import { ArrowDown, ArrowRight, Check, Plus } from 'lucide-react';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import {
  CHAMADA_FINAL,
  DEFINICOES_DOS_PLANOS,
  GARANTIAS,
  HERO,
  PARA_QUEM,
  PASSOS,
  PERGUNTAS,
  PLANOS,
  RECURSOS,
  SECOES,
  type CabecalhoDeSecao,
  type Plano,
} from './conteudo';
import { FunilInterativo } from './funil-interativo';
import { Jornada } from './jornada';
import { MiniVisual } from './mini-visuais';
import { MockupPainel } from './mockup-painel';
import { TextoComTermo } from './termo';
import { VideoHero } from './video-hero';

export const metadata: Metadata = {
  title: 'Sistema de gestão para empresas de serviço',
  description:
    'Clientes, orçamentos, agenda e dinheiro no mesmo lugar. Veja quanto sobrou de cada serviço, sem montar planilha. 14 dias grátis, sem cartão de crédito.',
};

/**
 * A página inicial, na ordem de uma conversa com quem nunca viu o produto:
 * o que é e para quem, como funciona em três passos, um serviço de ponta a
 * ponta, o quadro para mexer com as próprias mãos, o que vem junto, a
 * segurança, o preço, as dúvidas e o convite.
 *
 * Todo texto vem de `conteudo.ts`; aqui é só apresentação. O visual (paleta,
 * tipografia, movimento) mora em `site.css`, e vale só dentro do layout do site.
 */
export default function PaginaInicial() {
  return (
    <>
      <Hero />
      <ParaQuem />
      <ComoFunciona />
      <PontaAPonta />
      <FunilERecursos />
      <Seguranca />
      <Planos />
      <Duvidas />
      <ChamadaFinal />
    </>
  );
}

/** Atraso de entrada e ordem de revelação, como variáveis CSS. */
function atraso(ms: number): CSSProperties {
  return { '--atraso': `${ms}ms` } as CSSProperties;
}

function ordem(indice: number): CSSProperties {
  return { '--ordem': indice } as CSSProperties;
}

/** Rótulo, título em duas partes (a segunda em itálico de acento) e introdução. */
function CabecalhoSecao({
  cabecalho,
  centralizado = false,
  className,
}: {
  cabecalho: CabecalhoDeSecao;
  centralizado?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'surgir flex max-w-2xl flex-col gap-5',
        centralizado && 'mx-auto items-center text-center',
        className,
      )}
    >
      <p className="rotulo">{cabecalho.rotulo}</p>
      <h2 className="display text-[clamp(2.25rem,4.6vw,3.5rem)]">
        {cabecalho.titulo} <em>{cabecalho.enfase}</em>
      </h2>
      {cabecalho.intro && (
        <p className="text-muted-foreground text-lg leading-relaxed">{cabecalho.intro}</p>
      )}
    </div>
  );
}

function Hero() {
  return (
    <section aria-labelledby="titulo-hero" className="hero-com-video">
      <VideoHero />
      <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-6 pt-14 pb-20 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-24 lg:pb-28">
        <div className="flex flex-col items-start gap-7">
          <p className="rotulo entrada">{HERO.rotulo}</p>

          <h1
            id="titulo-hero"
            className="display entrada text-[clamp(2.75rem,7vw,5.25rem)]"
            style={atraso(60)}
          >
            {HERO.titulo} <em>{HERO.enfase}</em>
          </h1>

          <p
            className="entrada text-muted-foreground max-w-xl text-lg leading-relaxed"
            style={atraso(140)}
          >
            {HERO.subtitulo}
          </p>

          <div className="entrada flex flex-wrap items-center gap-x-7 gap-y-4" style={atraso(220)}>
            <Link href="/cadastro" className="botao botao-acento">
              {HERO.chamada}
              <ArrowRight aria-hidden />
            </Link>
            <a href="#como-funciona" className="link-seta text-sm">
              {HERO.secundaria}
              <ArrowDown aria-hidden className="size-4" />
            </a>
          </div>

          <ul
            className="entrada text-muted-foreground flex flex-wrap gap-x-5 gap-y-2 text-sm"
            style={atraso(300)}
          >
            {HERO.garantias.map((garantia) => (
              <li key={garantia} className="flex items-center gap-1.5">
                <Check aria-hidden className="size-4 text-(--acento)" />
                {garantia}
              </li>
            ))}
          </ul>
        </div>

        <div className="paralaxe">
          <MockupPainel />
        </div>
      </div>
    </section>
  );
}

function ParaQuem() {
  return (
    <section aria-label="Para quem é" className="border-y bg-(--papel-2)">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 py-10 lg:flex-row lg:items-center lg:gap-12">
        <p className="rotulo shrink-0">{PARA_QUEM.rotulo}</p>

        <div className="flex flex-col gap-2">
          <ul className="display flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[clamp(1.6rem,3.2vw,2.25rem)]">
            {PARA_QUEM.negocios.map((negocio, indice) => (
              <li key={negocio} className="flex items-baseline gap-4">
                {indice > 0 && (
                  <span aria-hidden className="text-(--acento)">
                    ·
                  </span>
                )}
                {negocio}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-sm">{PARA_QUEM.complemento}</p>
        </div>
      </div>
    </section>
  );
}

function ComoFunciona() {
  return (
    <section id="como-funciona" className="scroll-mt-20">
      <div className="mx-auto w-full max-w-6xl px-6 py-24 lg:py-32">
        <CabecalhoSecao cabecalho={SECOES.comoFunciona} />

        <ol className="mt-14 grid gap-5 md:grid-cols-3">
          {PASSOS.map((passo, indice) => (
            <li key={passo.titulo} className="surgir" style={ordem(indice)}>
              {/* `relative`: no celular, o balão dos termos se ancora neste cartão. */}
              <div className="cartao elevavel relative flex h-full flex-col gap-4 p-7 sm:p-8">
                <span aria-hidden className="numero-destaque text-6xl leading-none text-(--acento)">
                  {String(indice + 1).padStart(2, '0')}
                </span>
                <h3 className="display text-2xl">{passo.titulo}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  <TextoComTermo partes={passo.descricao} />
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function PontaAPonta() {
  return (
    <section id="ponta-a-ponta" className="scroll-mt-20 border-t bg-(--papel-2)">
      <div className="mx-auto w-full max-w-4xl px-6 py-24 lg:py-32">
        <CabecalhoSecao cabecalho={SECOES.pontaAPonta} />
        <Jornada />
      </div>
    </section>
  );
}

function FunilERecursos() {
  return (
    <section id="recursos" className="scroll-mt-20 border-t">
      <div className="mx-auto w-full max-w-6xl px-6 py-24 lg:py-32">
        <CabecalhoSecao cabecalho={SECOES.funil} />

        <div className="surgir mt-12">
          <FunilInterativo />
        </div>

        <CabecalhoSecao cabecalho={SECOES.recursos} className="mt-28" />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map((recurso, indice) => (
            <div key={recurso.titulo} className="surgir" style={ordem(indice % 3)}>
              <article className="cartao elevavel flex h-full flex-col gap-4 p-5">
                <MiniVisual tipo={recurso.visual} />
                <div className="flex flex-col gap-2 px-1 pb-1">
                  <h3 className="flex items-center gap-2 font-semibold tracking-tight">
                    <recurso.icone aria-hidden className="size-4 text-(--acento)" />
                    {recurso.titulo}
                  </h3>
                  <p className="display text-[1.05rem] italic">{recurso.pergunta}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {recurso.descricao}
                  </p>
                </div>
              </article>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Segurança numa faixa escura, nos dois temas: a mudança de fundo marca a
 * troca de assunto (do que o sistema faz para como ele guarda os seus dados).
 */
function Seguranca() {
  return (
    <section id="seguranca" className="invertido scroll-mt-20">
      <div className="mx-auto grid w-full max-w-6xl gap-14 px-6 py-24 lg:grid-cols-[0.95fr_1.05fr] lg:py-32">
        <CabecalhoSecao cabecalho={SECOES.seguranca} />

        <ul className="flex flex-col">
          {GARANTIAS.map((garantia, indice) => (
            <li
              key={garantia.titulo}
              className="surgir flex gap-5 border-t py-7 first:border-t-0 first:pt-0"
              style={ordem(indice)}
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-(--acento)/40 text-(--acento)">
                <garantia.icone aria-hidden className="size-5" />
              </span>
              <div className="flex flex-col gap-1.5">
                <h3 className="display text-xl">{garantia.titulo}</h3>
                <p className="text-muted-foreground leading-relaxed">{garantia.descricao}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Planos() {
  return (
    <section id="planos" className="scroll-mt-20">
      <div className="mx-auto w-full max-w-5xl px-6 py-24 lg:py-32">
        <CabecalhoSecao cabecalho={SECOES.planos} centralizado />

        <div className="mt-14 grid items-stretch gap-6 md:grid-cols-2">
          {PLANOS.map((plano, indice) => (
            <div key={plano.nome} className="surgir" style={ordem(indice)}>
              <CartaoPlano plano={plano} />
            </div>
          ))}
        </div>

        <dl className="text-muted-foreground mx-auto mt-10 grid max-w-3xl gap-4 text-sm leading-relaxed sm:grid-cols-2">
          {DEFINICOES_DOS_PLANOS.map((item) => (
            <div key={item.termo}>
              <dt className="text-foreground font-semibold">
                O que é “{item.termo.toLowerCase()}”?
              </dt>
              <dd>{item.definicao}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function CartaoPlano({ plano }: { plano: Plano }) {
  return (
    <article
      className={cn(
        'cartao elevavel relative flex h-full flex-col gap-7 p-8 sm:p-10',
        plano.destaque && 'border-(--acento)/45 ring-1 ring-(--acento)/25',
      )}
    >
      {plano.destaque && (
        <span className="absolute -top-3 left-8 rounded-full bg-(--acento) px-3 py-1 text-[0.7rem] font-semibold tracking-wide text-(--acento-texto) uppercase sm:left-10">
          Recomendado
        </span>
      )}

      <div className="flex flex-col gap-3">
        <h3 className="display text-3xl">{plano.nome}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{plano.resumo}</p>
        <p className="mt-2 flex items-baseline gap-1.5">
          <span className="numero-destaque text-6xl">R$ {plano.preco}</span>
          <span className="text-muted-foreground">/mês</span>
        </p>
      </div>

      <ul className="flex flex-1 flex-col gap-3 border-t pt-6">
        {plano.itens.map((item) => (
          <li key={item} className="flex gap-3 text-sm">
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-(--acento)" />
            {item}
          </li>
        ))}
      </ul>

      <Link
        href="/cadastro"
        className={cn('botao w-full', plano.destaque ? 'botao-acento' : 'botao-contorno')}
      >
        Começar com 14 dias grátis
        <ArrowRight aria-hidden />
      </Link>
    </article>
  );
}

/**
 * As dúvidas, em sanfona de `<details>`: sem JavaScript, com todo o texto no
 * HTML (bom para quem busca a pergunta no Google), e várias abertas ao mesmo
 * tempo, porque a pessoa costuma comparar respostas.
 */
function Duvidas() {
  return (
    <section id="duvidas" className="scroll-mt-20 border-t bg-(--papel-2)">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-24 lg:grid-cols-[0.85fr_1.15fr] lg:py-32">
        <CabecalhoSecao cabecalho={SECOES.duvidas} />

        <div className="surgir flex flex-col border-t">
          {PERGUNTAS.map((item) => (
            <details key={item.pergunta} className="group border-b">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-left select-none [&::-webkit-details-marker]:hidden">
                <span className="display text-xl">{item.pergunta}</span>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border transition-[transform,border-color] duration-300 group-open:rotate-45 group-open:border-(--acento)">
                  <Plus aria-hidden className="size-4" />
                </span>
              </summary>
              <p className="text-muted-foreground max-w-2xl pb-6 leading-relaxed">
                {item.resposta}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function ChamadaFinal() {
  return (
    <section className="halo relative overflow-x-clip border-t">
      <div className="surgir mx-auto flex w-full max-w-3xl flex-col items-center gap-7 px-6 py-28 text-center lg:py-36">
        <h2 className="display text-[clamp(2.5rem,6vw,4.5rem)]">
          {CHAMADA_FINAL.titulo} <em>{CHAMADA_FINAL.enfase}</em>
        </h2>
        <p className="text-muted-foreground max-w-xl text-lg leading-relaxed">
          {CHAMADA_FINAL.texto}
        </p>
        <div className="flex flex-col items-center gap-3">
          <Link href="/cadastro" className="botao botao-acento">
            {CHAMADA_FINAL.chamada}
            <ArrowRight aria-hidden />
          </Link>
          <p className="text-muted-foreground text-xs">{CHAMADA_FINAL.observacao}</p>
        </div>
      </div>
    </section>
  );
}
