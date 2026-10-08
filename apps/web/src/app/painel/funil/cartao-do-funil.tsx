'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { formatarBRL, formatarTelefone, type ClienteNoFunil } from '@gestao/shared-types';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  GripVertical,
  Mail,
  MessageCircle,
  Phone,
  Tag,
} from 'lucide-react';
import Link from 'next/link';
import { linkEmail, linkTelefone, linkWhatsApp } from '@/lib/contato';
import {
  estilosAvatarEtiqueta,
  estilosCartaoComEtiqueta,
  estilosEtiqueta,
  estilosMarcadorEtiqueta,
} from '@/lib/etiquetas';
import { cn } from '@/lib/utils';

/** O cartão de um cliente no quadro do funil, com as ações rápidas. */

/**
 * Cor de cada etapa, na ordem do funil.
 *
 * Usa a série de gráficos do tema, que já foi escolhida para as cores serem
 * distinguíveis entre si — inclusive para quem tem deficiência de visão de
 * cores. Aqui a cor é só um apoio de reconhecimento: o nome da etapa está
 * sempre ao lado, então ninguém depende dela para entender o quadro.
 */
export const COR_DA_ETAPA = [
  'bg-grafico-1',
  'bg-grafico-2',
  'bg-grafico-3',
  'bg-grafico-4',
  'bg-grafico-5',
] as const;

export function CartaoDoFunil({
  cliente,
  etapaAtual,
  corEtapa,
  etapas,
  aoTrocarEtapa,
  aoAbrir,
}: {
  cliente: ClienteNoFunil;
  etapaAtual: string;
  corEtapa: (typeof COR_DA_ETAPA)[number];
  etapas: { id: string; nome: string }[];
  aoTrocarEtapa: (etapaId: string, chaveDeFoco?: string) => void;
  aoAbrir: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: cliente.id,
  });

  // Dias na etapa e "parado" (o corte de uma semana) vêm calculados da API.
  const { diasNaEtapa: dias, parado } = cliente;

  // As etapas vizinhas alimentam as setas do rodapé. `undefined` nas pontas do
  // funil: na primeira etapa não há para onde voltar, na última não há para
  // onde avançar — e aí o botão aparece desabilitado, em vez de sumir. Um botão
  // que desaparece muda o cartão de lugar a cada movimento; um desabilitado
  // ensina onde é o fim da linha.
  const posicao = etapas.findIndex((etapa) => etapa.id === etapaAtual);
  const etapaAnterior = posicao > 0 ? etapas[posicao - 1] : undefined;
  const etapaSeguinte = posicao >= 0 ? etapas[posicao + 1] : undefined;

  const whatsapp = linkWhatsApp(cliente.telefone);
  const telefone = linkTelefone(cliente.telefone);
  const email = linkEmail(cliente.email);
  const corPrincipal = cliente.etiquetas[0]?.cor;

  return (
    <article
      ref={setNodeRef}
      // Marca o cartão como território do dnd-kit: o arrasto-para-rolar do
      // quadro ignora tudo que estiver aqui dentro, então pegar um cartão pela
      // borda move o cartão, e não o quadro atrás dele.
      data-cartao
      style={{
        ...estilosCartaoComEtiqueta(corPrincipal),
        transform: CSS.Translate.toString(transform),
      }}
      className={cn(
        'group bg-card relative flex flex-col gap-2 overflow-hidden rounded-lg border p-3 shadow-(--sombra-sutil)',
        'transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-input hover:shadow-(--sombra-media)',
        // A faixa lateral marca o cartão parado sem gastar espaço com texto.
        parado && 'border-l-atencao border-l-2',
        isDragging && 'opacity-40',
      )}
    >
      {corPrincipal && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1"
          style={estilosMarcadorEtiqueta(corPrincipal)}
        />
      )}

      {/*
        Esta área faz duas coisas: inicia o arrasto e abre o cartão no clique.
        Elas não se atropelam porque o sensor só considera arrasto depois de
        8px de movimento — abaixo disso o gesto é um clique, e o `onClick` do
        dnd-kit não dispara quando houve arrasto de verdade.

        É um `<button>` para funcionar no teclado: Enter e Espaço abrem o
        cartão, e o leitor de tela anuncia que há algo a acionar.
      */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={aoAbrir}
        aria-label={`Abrir cartão de ${cliente.nome}`}
        className="group/arrastar flex w-full cursor-grab flex-col gap-2 text-left active:cursor-grabbing"
      >
        <span
          aria-hidden
          className={cn('h-1.5 w-12 rounded-full', !corPrincipal && corEtapa)}
          style={estilosMarcadorEtiqueta(corPrincipal)}
        />

        <div className="flex items-start gap-2.5">
          {/* Iniciais no lugar de foto: o CRM não guarda imagem de cliente, e
              uma inicial já dá ao olho um ponto de ancoragem para varrer a
              coluna sem ler nome por nome. */}
          <span
            aria-hidden
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-semibold',
              !corPrincipal && 'bg-primary text-primary-foreground',
            )}
            style={estilosAvatarEtiqueta(corPrincipal)}
          >
            {iniciais(cliente.nome)}
          </span>

          <div className="flex min-w-0 flex-1 flex-col">
            <p className="truncate text-sm leading-tight font-semibold">{cliente.nome}</p>

            {cliente.telefone && (
              <p className="text-muted-foreground numerico mt-0.5 text-xs">
                {formatarTelefone(cliente.telefone)}
              </p>
            )}
          </div>

          {/*
            A alça só aparece ao passar o mouse. Ela não move nada sozinha — o
            cartão inteiro já é arrastável — mas ensina que ele pode ser
            arrastado, que é a única parte do quadro que ninguém descobre
            sozinho.
          */}
          <GripVertical
            aria-hidden
            className="text-muted-foreground/50 size-4 shrink-0 opacity-0 transition-opacity group-hover/arrastar:opacity-100"
          />
        </div>

        {/* O valor em negociação, quando há proposta em aberto. É o que permite
            ler o quadro como visão de negócio, e não como lista de nomes. */}
        {cliente.orcamentoAberto && (
          <div className="bg-primary/10 flex items-baseline justify-between gap-2 rounded-md px-2.5 py-1.5">
            <span className="numerico text-sm font-semibold">
              {formatarBRL(cliente.orcamentoAberto.valor)}
            </span>

            {cliente.orcamentoAberto.servicoNome && (
              <span className="text-muted-foreground truncate text-xs">
                {cliente.orcamentoAberto.servicoNome}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {cliente.origem && (
            <span className="bg-accent text-muted-foreground inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium">
              <Tag aria-hidden className="size-3" />
              <span className="truncate">{cliente.origem}</span>
            </span>
          )}
          {email && (
            <span className="text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem]">
              <Mail aria-hidden className="size-3" />
              e-mail
            </span>
          )}
        </div>

        {cliente.etiquetas.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {cliente.etiquetas.map((etiqueta) => (
              <EtiquetaDoCliente key={etiqueta.id} nome={etiqueta.nome} cor={etiqueta.cor} />
            ))}
          </div>
        )}

        <p
          className={cn(
            'flex items-center gap-1.5 text-xs',
            parado ? 'text-atencao font-medium' : 'text-muted-foreground',
          )}
        >
          <Clock aria-hidden className="size-3.5" />
          {dias === 0
            ? 'Entrou hoje'
            : dias === 1
              ? 'Há 1 dia nesta etapa'
              : `Há ${dias} dias nesta etapa`}
        </p>
      </button>

      {/*
        Falar com o cliente é o que mais se faz olhando o funil. Sem estes
        atalhos, o caminho era selecionar o telefone, copiar, abrir o WhatsApp e
        colar. Ficam **fora** do botão acima de propósito: link dentro de botão
        é marcação inválida e o clique não chegaria ao destino.
      */}
      {(whatsapp || telefone || email) && (
        <div className="flex items-center gap-1">
          {whatsapp && (
            <AcaoContato href={whatsapp} rotulo={`Conversar com ${cliente.nome} no WhatsApp`}>
              <MessageCircle aria-hidden className="size-3.5" />
            </AcaoContato>
          )}

          {telefone && (
            <AcaoContato href={telefone} rotulo={`Ligar para ${cliente.nome}`}>
              <Phone aria-hidden className="size-3.5" />
            </AcaoContato>
          )}

          {email && (
            <AcaoContato href={email} rotulo={`Enviar e-mail para ${cliente.nome}`}>
              <Mail aria-hidden className="size-3.5" />
            </AcaoContato>
          )}
        </div>
      )}

      {/*
        Mover sem arrastar.

        Arrastar é o gesto bonito, mas é o pior caminho para o trabalho do dia:
        no celular quase não funciona, e mesmo no computador levar um cartão da
        primeira até a última etapa obriga a arrastar por cima de um quadro que
        rola na horizontal.

        Então as setas fazem o movimento que realmente se repete — avançar uma
        etapa — em **um clique**. O seletor no meio continua ali para o pulo
        longo ("de Novo direto para Fechado"), que é raro mas existe.

        Os três funcionam por teclado e leitor de tela, sem depender de gesto.
      */}
      <div className="flex items-center gap-1 border-t pt-2">
        <BotaoMoverEtapa
          clienteId={cliente.id}
          destino={etapaAnterior}
          nomeCliente={cliente.nome}
          sentido="anterior"
          aoAcionar={aoTrocarEtapa}
        />

        <label className="sr-only" htmlFor={`etapa-${cliente.id}`}>
          Etapa de {cliente.nome}
        </label>
        <select
          id={`etapa-${cliente.id}`}
          value={etapaAtual}
          onChange={(evento) => aoTrocarEtapa(evento.target.value)}
          className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring bg-background/60 h-7 min-w-0 flex-1 cursor-pointer rounded border-0 px-1.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          {etapas.map((etapa) => (
            <option key={etapa.id} value={etapa.id}>
              {etapa.nome}
            </option>
          ))}
        </select>

        <BotaoMoverEtapa
          clienteId={cliente.id}
          destino={etapaSeguinte}
          nomeCliente={cliente.nome}
          sentido="seguinte"
          aoAcionar={aoTrocarEtapa}
        />

        <Link
          href={`/painel/clientes/${cliente.id}`}
          className="text-muted-foreground hover:bg-accent hover:text-foreground ml-0.5 flex size-7 shrink-0 items-center justify-center rounded transition-colors"
          aria-label={`Abrir ficha de ${cliente.nome}`}
        >
          <ExternalLink aria-hidden className="size-3.5" />
        </Link>
      </div>
    </article>
  );
}

/**
 * Move o cartão uma etapa, para trás ou para frente.
 *
 * O rótulo diz o destino por extenso — "Avançar para Proposta enviada", e não
 * "Avançar" —, porque no leitor de tela um botão chamado "Avançar" repetido em
 * trinta cartões não informa nada. O `title` faz o mesmo pelo mouse: o destino
 * aparece antes do clique, e ninguém precisa descobrir para onde o cartão foi
 * depois que ele já se mexeu.
 *
 * Sem destino, o botão fica desabilitado em vez de sumir — ver a seta apagada
 * na última etapa é o que comunica que ali é o fim do funil.
 */
function BotaoMoverEtapa({
  clienteId,
  destino,
  nomeCliente,
  sentido,
  aoAcionar,
}: {
  clienteId: string;
  destino: { id: string; nome: string } | undefined;
  nomeCliente: string;
  sentido: 'anterior' | 'seguinte';
  aoAcionar: (etapaId: string, chaveDeFoco?: string) => void;
}) {
  const Icone = sentido === 'anterior' ? ChevronLeft : ChevronRight;
  const verbo = sentido === 'anterior' ? 'Voltar' : 'Avançar';

  const rotulo = destino
    ? `${verbo} ${nomeCliente} para ${destino.nome}`
    : sentido === 'anterior'
      ? `${nomeCliente} já está na primeira etapa`
      : `${nomeCliente} já está na última etapa`;

  // Como o cartão é remontado na coluna de destino, é por este atributo que o
  // quadro reencontra "o mesmo botão, no lugar novo" para devolver o foco.
  const chave = `${clienteId}:${sentido}`;

  return (
    <button
      type="button"
      data-mover={chave}
      disabled={!destino}
      onClick={() => destino && aoAcionar(destino.id, chave)}
      aria-label={rotulo}
      title={rotulo}
      className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring flex size-7 shrink-0 items-center justify-center rounded transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30"
    >
      <Icone aria-hidden className="size-4" />
    </button>
  );
}

function EtiquetaDoCliente({ nome, cor }: { nome: string; cor: string }) {
  return (
    <span
      className="inline-flex min-h-5 max-w-full items-center rounded-[5px] border px-2.5 py-0.5 text-[0.6875rem] font-semibold"
      style={estilosEtiqueta(cor)}
      title={nome}
    >
      <span className="truncate">{nome}</span>
    </span>
  );
}

/**
 * Botão de contato direto.
 *
 * `target="_blank"` com `rel="noopener"`: o WhatsApp Web abre em aba própria e,
 * sem o `noopener`, a página aberta ganharia referência à nossa via
 * `window.opener` — porta conhecida para sequestro de aba.
 *
 * `onClick` com `stopPropagation` impede que o clique suba até o cartão e abra
 * a janela de detalhe junto: quem clicou em "WhatsApp" quer o WhatsApp.
 */
function AcaoContato({
  href,
  rotulo,
  children,
}: {
  href: string;
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={rotulo}
      title={rotulo}
      onClick={(evento) => evento.stopPropagation()}
      className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-7 items-center justify-center rounded-md transition-colors"
    >
      {children}
    </a>
  );
}

/**
 * Duas letras a partir do nome.
 *
 * Primeira e última palavra, para "Maria Souza Lima" virar "ML" — mais
 * distintivo do que as duas primeiras letras, que empilhariam vários "MA" numa
 * coluna de Marias.
 */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);

  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();

  return `${partes[0]![0]}${partes[partes.length - 1]![0]}`.toUpperCase();
}
