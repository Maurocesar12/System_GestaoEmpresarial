'use client';

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  diasNaEtapa,
  formatarBRL,
  formatarTelefone,
  somarDinheiro,
  type ClienteNoFunil,
  type QuadroFunil,
} from '@gestao/shared-types';
import { Clock, ExternalLink, GripVertical, Mail, MessageCircle, Phone } from 'lucide-react';
import Link from 'next/link';
import { useOptimistic, useState, useTransition } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { linkEmail, linkTelefone, linkWhatsApp } from '@/lib/contato';
import { cn } from '@/lib/utils';
import { moverCliente } from './acoes';
import { CartaoAberto } from './cartao-aberto';
import { NovoCartao } from './novo-cartao';

/**
 * Dias parado numa etapa a partir do qual a negociação merece atenção.
 * O mesmo corte que o painel inicial usa para listar "paradas".
 */
const DIAS_PARA_ALERTA = 7;

/**
 * Quadro do funil.
 *
 * ## Atualização otimista
 *
 * Quando o cartão é solto, ele aparece na coluna nova **antes** de a API
 * confirmar. Arrastar é um gesto físico: esperar meio segundo pelo servidor
 * para o cartão então pular de lugar quebra a sensação de estar manipulando um
 * objeto. Se a chamada falhar, o `useOptimistic` desfaz sozinho e a mensagem
 * de erro aparece.
 *
 * ## Acessibilidade
 *
 * Arrastar e soltar exclui quem usa teclado ou leitor de tela. O `KeyboardSensor`
 * do dnd-kit resolve metade — Espaço pega o cartão, setas movem, Espaço solta.
 * A outra metade é o `<select>` em cada cartão, que muda a etapa sem gesto
 * nenhum e funciona igual no celular, onde arrastar entre colunas é penoso.
 */
export function Quadro({ quadro }: { quadro: QuadroFunil }) {
  const [erro, setErro] = useState<string>();
  const [, iniciarMovimento] = useTransition();
  const [arrastando, setArrastando] = useState<ClienteNoFunil | null>(null);

  // Qual cartão está aberto. Guarda o id, e não o objeto: assim o cartão aberto
  // acompanha as atualizações do quadro em vez de exibir uma cópia congelada
  // do momento do clique.
  const [abertoId, setAbertoId] = useState<string | null>(null);

  // O estado otimista espelha o quadro e é recalculado quando o servidor
  // devolve dados novos — nenhuma cópia local sobrevive ao recarregamento.
  const [colunas, moverOtimista] = useOptimistic(
    quadro.colunas,
    (atual, { clienteId, etapaId }: { clienteId: string; etapaId: string }) => {
      const cliente = atual.flatMap((c) => c.clientes).find((c) => c.id === clienteId);
      if (!cliente) return atual;

      return atual.map((coluna) => ({
        ...coluna,
        clientes:
          coluna.etapa.id === etapaId
            ? [cliente, ...coluna.clientes.filter((c) => c.id !== clienteId)]
            : coluna.clientes.filter((c) => c.id !== clienteId),
      }));
    },
  );

  const sensores = useSensors(
    // 8px de tolerância antes de considerar arrasto: sem isso, um clique com
    // tremida no mouse viraria movimentação acidental.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const mover = (clienteId: string, etapaId: string) => {
    setErro(undefined);

    iniciarMovimento(async () => {
      moverOtimista({ clienteId, etapaId });
      const resultado = await moverCliente({ clienteId, etapaId });
      setErro(resultado.erro);
    });
  };

  const aoSoltar = (evento: DragEndEvent) => {
    setArrastando(null);

    const etapaDestino = evento.over?.id;
    const clienteId = evento.active.id;

    if (!etapaDestino || typeof etapaDestino !== 'string' || typeof clienteId !== 'string') {
      return;
    }

    // Soltar na mesma coluna de onde saiu não é movimento.
    const origem = colunas.find((c) => c.clientes.some((cl) => cl.id === clienteId));
    if (origem?.etapa.id === etapaDestino) {
      return;
    }

    mover(clienteId, etapaDestino);
  };

  const aoPegar = (evento: DragStartEvent) => {
    const cliente = colunas.flatMap((c) => c.clientes).find((c) => c.id === evento.active.id);
    setArrastando(cliente ?? null);
  };

  // Recalculado a cada render: se o cartão for movido de coluna enquanto está
  // aberto, a etapa exibida acompanha.
  const aberto = abertoId
    ? colunas
        .flatMap((coluna) =>
          coluna.clientes.map((cliente) => ({ cliente, etapaId: coluna.etapa.id })),
        )
        .find((item) => item.cliente.id === abertoId)
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      {erro && <AvisoErro mensagem={erro} />}

      {/*
        O `id` fixo não é enfeite: sem ele, o dnd-kit gera o
        `aria-describedby` dos cartões a partir de um contador de módulo
        (`DndDescribedBy-0`, `-1`, `-2`…). Esse contador vive no processo, e o
        processo do servidor atende várias requisições — então o servidor
        renderizava `DndDescribedBy-4` enquanto o navegador, recém-carregado,
        esperava `DndDescribedBy-0`. O React acusava diferença de hidratação em
        todo cartão.

        Com um `id` informado, a biblioteca o usa literalmente nos dois lados,
        tanto no atributo dos cartões quanto no elemento de descrição que ela
        renderiza para leitores de tela.
      */}
      <DndContext id="funil" sensors={sensores} onDragStart={aoPegar} onDragEnd={aoSoltar}>
        {/* O quadro rola na horizontal; a página, não. */}
        <div className="flex gap-3 overflow-x-auto pb-4">
          {colunas.map((coluna, indice) => (
            <Coluna
              key={coluna.etapa.id}
              id={coluna.etapa.id}
              nome={coluna.etapa.nome}
              indice={indice}
              clientes={coluna.clientes}
              etapas={colunas.map((c) => c.etapa)}
              aoTrocarEtapa={mover}
              aoAbrir={setAbertoId}
            />
          ))}
        </div>

        {/*
          O cartão que segue o cursor. A leve inclinação é o truque que dá
          sensação de peso ao gesto — sem ela, o cartão parece deslizar sobre
          vidro em vez de estar sendo carregado.
        */}
        <DragOverlay>
          {arrastando && (
            <div className="bg-card w-[19rem] rotate-3 rounded-lg border p-3.5 shadow-[var(--sombra-media)]">
              <p className="text-sm font-semibold">{arrastando.nome}</p>
              {arrastando.orcamentoAberto && (
                <p className="numerico mt-1 text-sm font-semibold">
                  {formatarBRL(arrastando.orcamentoAberto.valor)}
                </p>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {aberto && (
        <CartaoAberto
          // A chave força um cartão novo ao trocar de cliente, em vez de o
          // React reaproveitar o anterior e manter estado de edição de outro.
          key={aberto.cliente.id}
          cliente={aberto.cliente}
          etapaAtual={aberto.etapaId}
          etapas={colunas.map((c) => c.etapa)}
          aoTrocarEtapa={(etapaId) => mover(aberto.cliente.id, etapaId)}
          aoFechar={() => setAbertoId(null)}
        />
      )}
    </div>
  );
}

/**
 * Cor de cada etapa, na ordem do funil.
 *
 * Usa a série de gráficos do tema, que já foi escolhida para as cores serem
 * distinguíveis entre si — inclusive para quem tem deficiência de visão de
 * cores. Aqui a cor é só um apoio de reconhecimento: o nome da etapa está
 * sempre ao lado, então ninguém depende dela para entender o quadro.
 */
const COR_DA_ETAPA = [
  'bg-grafico-1',
  'bg-grafico-2',
  'bg-grafico-3',
  'bg-grafico-4',
  'bg-grafico-5',
] as const;

/**
 * Uma coluna do quadro.
 *
 * Altura fixa com rolagem **interna**: sem isso, uma coluna com trinta clientes
 * esticaria a página e as outras colunas ficariam com um rodapé inalcançável a
 * três telas de distância. Rolando por dentro, o cabeçalho e o "adicionar
 * cliente" continuam sempre à vista.
 */
function Coluna({
  id,
  nome,
  indice,
  clientes,
  etapas,
  aoTrocarEtapa,
  aoAbrir,
}: {
  id: string;
  nome: string;
  /** Posição da etapa no funil — define a cor do marcador. */
  indice: number;
  clientes: ClienteNoFunil[];
  etapas: { id: string; nome: string }[];
  aoTrocarEtapa: (clienteId: string, etapaId: string) => void;
  aoAbrir: (clienteId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  // Quanto há em negociação nesta etapa. É o número que transforma o quadro de
  // lista de nomes em leitura de negócio: "tenho R$ 18 mil parados em
  // orçamento enviado".
  const total = somarDinheiro(clientes.map((cliente) => cliente.orcamentoAberto?.valor ?? '0.00'));

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'bg-superficie flex max-h-[calc(100vh-15rem)] w-80 shrink-0 flex-col rounded-xl border transition-colors',
        // Realce durante o arrasto: sem ele, não fica claro onde o cartão cai.
        isOver && 'border-primary bg-primary/5',
      )}
    >
      {/*
        Cabeçalho fixo: com a coluna rolando por dentro, ele precisa continuar
        visível — saber em que etapa se está enquanto se percorre trinta
        clientes é o mínimo para não se perder.
      */}
      <header className="bg-superficie sticky top-0 z-10 flex flex-col gap-1 rounded-t-xl border-b px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            {/* O ponto colorido dá à etapa uma identidade que o olho reconhece
                de relance, sem precisar ler o título de cada coluna. */}
            <span aria-hidden className={cn('size-2 rounded-full', COR_DA_ETAPA[indice % 5])} />
            {nome}
          </h2>

          <span className="text-muted-foreground numerico bg-background rounded-full border px-2 py-0.5 text-xs font-medium">
            {clientes.length}
          </span>
        </div>

        {Number(total) > 0 && (
          <p className="numerico text-muted-foreground pl-4 text-xs">
            <span className="text-foreground font-semibold">{formatarBRL(total)}</span> em
            negociação
          </p>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-2.5">
        {clientes.map((cliente) => (
          <Cartao
            key={cliente.id}
            cliente={cliente}
            etapaAtual={id}
            etapas={etapas}
            aoTrocarEtapa={(etapaId) => aoTrocarEtapa(cliente.id, etapaId)}
            aoAbrir={() => aoAbrir(cliente.id)}
          />
        ))}

        {clientes.length === 0 && (
          <p
            className={cn(
              'rounded-lg border border-dashed px-3 py-8 text-center text-xs transition-colors',
              isOver ? 'border-primary text-primary' : 'text-muted-foreground',
            )}
          >
            {isOver ? 'Solte aqui' : 'Arraste um cliente para cá'}
          </p>
        )}
      </div>

      <div className="border-t p-2">
        <NovoCartao etapaId={id} etapaNome={nome} />
      </div>
    </section>
  );
}

function Cartao({
  cliente,
  etapaAtual,
  etapas,
  aoTrocarEtapa,
  aoAbrir,
}: {
  cliente: ClienteNoFunil;
  etapaAtual: string;
  etapas: { id: string; nome: string }[];
  aoTrocarEtapa: (etapaId: string) => void;
  aoAbrir: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: cliente.id,
  });

  const dias = diasNaEtapa(cliente.atualizadoEm);

  // Uma semana sem sair do lugar é o sinal de negociação esquecida — o mesmo
  // corte que o painel inicial usa para listar "paradas".
  const parado = dias >= DIAS_PARA_ALERTA;

  const whatsapp = linkWhatsApp(cliente.telefone);
  const telefone = linkTelefone(cliente.telefone);
  const email = linkEmail(cliente.email);

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        'bg-card flex flex-col gap-3 rounded-lg border p-3.5 shadow-[var(--sombra-sutil)] transition-shadow',
        'hover:shadow-[var(--sombra-media)]',
        // A faixa lateral marca o cartão parado sem gastar espaço com texto.
        parado && 'border-l-atencao border-l-2',
        isDragging && 'opacity-40',
      )}
    >
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
        className="group/arrastar flex w-full cursor-grab flex-col gap-3 text-left active:cursor-grabbing"
      >
        <div className="flex items-start gap-2.5">
          {/* Iniciais no lugar de foto: o CRM não guarda imagem de cliente, e
              uma inicial já dá ao olho um ponto de ancoragem para varrer a
              coluna sem ler nome por nome. */}
          <span
            aria-hidden
            className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
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
          <div className="bg-superficie flex items-baseline justify-between gap-2 rounded-md px-2.5 py-2">
            <span className="numerico text-base font-semibold">
              {formatarBRL(cliente.orcamentoAberto.valor)}
            </span>

            {cliente.orcamentoAberto.servicoNome && (
              <span className="text-muted-foreground truncate text-xs">
                {cliente.orcamentoAberto.servicoNome}
              </span>
            )}
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
              WhatsApp
            </AcaoContato>
          )}

          {telefone && (
            <AcaoContato href={telefone} rotulo={`Ligar para ${cliente.nome}`}>
              <Phone aria-hidden className="size-3.5" />
              Ligar
            </AcaoContato>
          )}

          {email && (
            <AcaoContato href={email} rotulo={`Enviar e-mail para ${cliente.nome}`}>
              <Mail aria-hidden className="size-3.5" />
              E-mail
            </AcaoContato>
          )}
        </div>
      )}

      {/* Alternativa ao arrasto: funciona por teclado, leitor de tela e no
          celular, onde arrastar entre colunas é desconfortável. */}
      <div className="flex items-center gap-2 border-t pt-2">
        <label className="sr-only" htmlFor={`etapa-${cliente.id}`}>
          Etapa de {cliente.nome}
        </label>
        <select
          id={`etapa-${cliente.id}`}
          value={etapaAtual}
          onChange={(evento) => aoTrocarEtapa(evento.target.value)}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring h-7 min-w-0 flex-1 cursor-pointer rounded border-0 bg-transparent px-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          {etapas.map((etapa) => (
            <option key={etapa.id} value={etapa.id}>
              {etapa.nome}
            </option>
          ))}
        </select>

        <Link
          href={`/painel/clientes/${cliente.id}`}
          className="text-muted-foreground hover:text-foreground shrink-0 rounded p-1 transition-colors"
          aria-label={`Abrir ficha de ${cliente.nome}`}
        >
          <ExternalLink aria-hidden className="size-3.5" />
        </Link>
      </div>
    </article>
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
      onClick={(evento) => evento.stopPropagation()}
      className="text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors"
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
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);

  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();

  return `${partes[0]![0]}${partes[partes.length - 1]![0]}`.toUpperCase();
}
