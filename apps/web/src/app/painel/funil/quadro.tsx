'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  formatarBRL,
  type ClienteNoFunil,
  type Etiqueta,
  type QuadroFunil,
} from '@gestao/shared-types';
import { CircleDollarSign, Clock, Filter, Search, Users } from 'lucide-react';
import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { estilosControle } from '@/components/ui/campo';
import { useArrastarParaRolar } from '@/lib/arrastar-para-rolar';
import { cn } from '@/lib/utils';
import { moverCliente, removerDoFunil } from './acoes';
import { CartaoAberto } from './cartao-aberto';
import { Coluna } from './coluna-do-funil';

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
 * ## Três formas de mover um cartão
 *
 * Arrastar é o gesto que todo mundo espera de um quadro, mas é o pior caminho
 * para o uso diário: exige mira, atravessa um quadro que rola na horizontal e,
 * no celular, disputa com a rolagem. Por isso ele é uma das formas, não a
 * única:
 *
 * 1. **Setas no rodapé do cartão** — um clique move uma etapa. É o movimento
 *    que mais se repete no dia (avançar a negociação) e agora é o mais barato.
 * 2. **Seletor de etapa** — para o pulo longo, de qualquer etapa para qualquer
 *    outra.
 * 3. **Arrastar** — mouse, toque (segurando) ou teclado, via `KeyboardSensor`:
 *    Espaço pega o cartão, setas movem, Espaço solta.
 *
 * As três chamam o mesmo `mover()`, então todas ganham a atualização otimista
 * e o desfazer automático em caso de erro.
 */
export function Quadro({ quadro, etiquetas }: { quadro: QuadroFunil; etiquetas: Etiqueta[] }) {
  const [erro, setErro] = useState<string>();
  const [, iniciarMovimento] = useTransition();
  const [arrastando, setArrastando] = useState<ClienteNoFunil | null>(null);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroRapido>('todos');

  // Qual cartão está aberto. Guarda o id, e não o objeto: assim o cartão aberto
  // acompanha as atualizações do quadro em vez de exibir uma cópia congelada
  // do momento do clique.
  const [abertoId, setAbertoId] = useState<string | null>(null);

  // O estado otimista espelha o quadro e é recalculado quando o servidor
  // devolve dados novos — nenhuma cópia local sobrevive ao recarregamento.
  const [colunas, atualizarFunilOtimista] = useOptimistic(
    quadro.colunas,
    (atual, acao: AcaoOtimistaFunil) => {
      if (acao.tipo === 'remover') {
        return atual.map((coluna) => ({
          ...coluna,
          clientes: coluna.clientes.filter((cliente) => cliente.id !== acao.clienteId),
        }));
      }

      const cliente = atual.flatMap((c) => c.clientes).find((c) => c.id === acao.clienteId);
      if (!cliente) {
        return atual;
      }

      return atual.map((coluna) => ({
        ...coluna,
        clientes:
          coluna.etapa.id === acao.etapaId
            ? [cliente, ...coluna.clientes.filter((c) => c.id !== acao.clienteId)]
            : coluna.clientes.filter((c) => c.id !== acao.clienteId),
      }));
    },
  );

  const sensores = useSensors(
    // Mouse e toque são separados de propósito.
    //
    // Antes havia um `PointerSensor` só, que atende os dois — e por isso
    // atendia mal o toque: qualquer deslize de 8px no celular virava arrasto,
    // e o dedo que tentava **rolar** a coluna acabava carregando um cartão. Na
    // prática, rolar o quadro no celular era uma loteria.
    //
    // Com sensores separados, cada gesto tem a regra certa: no mouse, 8px de
    // tolerância evita que uma tremida no clique mova o cartão; no toque, o
    // arrasto só começa após segurar o dedo parado por um instante, o que
    // devolve a rolagem normal ao quadro.
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  /**
   * Para onde devolver o foco depois que o cartão trocar de coluna.
   *
   * Mover remonta o cartão na coluna de destino, e o botão que acabou de ser
   * clicado deixa de existir — o foco cairia no corpo da página. Quem usa
   * teclado teria de percorrer o quadro inteiro de novo a cada etapa avançada,
   * o que anularia justamente a facilidade que as setas trazem.
   *
   * Guarda `clienteId:sentido` e é consumido pelo efeito abaixo.
   */
  const focoAposMover = useRef<string | null>(null);

  useEffect(() => {
    const chave = focoAposMover.current;
    if (!chave) return;
    focoAposMover.current = null;

    const botao = document.querySelector<HTMLButtonElement>(`[data-mover="${chave}"]`);
    if (botao && !botao.disabled) {
      botao.focus();
      return;
    }

    // Na ponta do funil a seta do mesmo sentido fica desabilitada e não aceita
    // foco. Cai no seletor de etapa do próprio cartão: continua sendo um
    // controle útil e mantém a pessoa no cartão que ela estava movendo.
    const clienteId = chave.split(':')[0];
    document.getElementById(`etapa-${clienteId}`)?.focus();
  });

  const mover = (clienteId: string, etapaId: string, chaveDeFoco?: string) => {
    setErro(undefined);
    focoAposMover.current = chaveDeFoco ?? null;

    iniciarMovimento(async () => {
      atualizarFunilOtimista({ tipo: 'mover', clienteId, etapaId });
      const resultado = await moverCliente({ clienteId, etapaId });
      setErro(resultado.erro);
    });
  };

  const remover = (clienteId: string) => {
    setErro(undefined);

    iniciarMovimento(async () => {
      atualizarFunilOtimista({ tipo: 'remover', clienteId });
      setAbertoId(null);

      const resultado = await removerDoFunil(clienteId);
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

  const rolagem = useArrastarParaRolar<HTMLDivElement>();

  // Os números do quadro vêm somados pela API. Durante um movimento otimista
  // eles seguem os do servidor e se acertam quando a API confirma.
  const metricas = {
    valorPipeline: quadro.valorPipeline,
    propostas: quadro.propostasAbertas,
    clientes: quadro.totalNoFunil,
    parados: quadro.totalParados,
    etapasComClientes: colunas.filter((coluna) => coluna.clientes.length > 0).length,
  };
  const colunasVisiveis = useMemo(
    () => filtrarColunas(colunas, busca, filtro),
    [busca, colunas, filtro],
  );
  const totalVisivel = colunasVisiveis.reduce((soma, coluna) => soma + coluna.clientes.length, 0);

  return (
    <div className="flex flex-col gap-4">
      {erro && <AvisoErro mensagem={erro} />}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica
          icone={CircleDollarSign}
          rotulo="Valor em negociação"
          valor={formatarBRL(metricas.valorPipeline)}
          detalhe={`${metricas.propostas} proposta(s) aberta(s)`}
        />
        <Metrica
          icone={Users}
          rotulo="Clientes no funil"
          valor={String(metricas.clientes)}
          detalhe={`${quadro.totalForaDoFunil} fora do funil`}
        />
        <Metrica
          icone={Clock}
          rotulo="Parados"
          valor={String(metricas.parados)}
          detalhe={`A partir de ${quadro.diasParaAlerta} dias na etapa`}
          alerta={metricas.parados > 0}
        />
        <Metrica
          icone={Filter}
          rotulo="Etapas ativas"
          valor={String(metricas.etapasComClientes)}
          detalhe={`${colunas.length} etapa(s) configurada(s)`}
        />
      </section>

      <div className="bg-card flex flex-col gap-3 rounded-xl border p-3 shadow-(--sombra-sutil) lg:flex-row lg:items-center lg:justify-between">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar no funil</span>
          <Search
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <input
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar por cliente, telefone, e-mail, origem ou serviço"
            className={cn(estilosControle, 'h-10 bg-background pl-9')}
          />
        </label>

        <div className="grid grid-cols-3 rounded-lg border bg-background p-1 sm:flex">
          {FILTROS_RAPIDOS.map((item) => {
            const ativo = filtro === item.valor;
            return (
              <button
                key={item.valor}
                type="button"
                onClick={() => setFiltro(item.valor)}
                className={cn(
                  'h-8 rounded-md px-3 text-xs font-medium whitespace-nowrap transition-colors',
                  ativo
                    ? 'bg-primary text-primary-foreground shadow-(--sombra-sutil)'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {item.rotulo}
              </button>
            );
          })}
        </div>
      </div>

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
        <div className="bg-card/70 rounded-2xl border p-3 shadow-(--sombra-sutil)">
          {/*
            Além da barra de rolagem, o fundo do quadro é uma alça: pegar um
            espaço vazio ou o cabeçalho de uma coluna e puxar move o quadro para
            o lado. A barra ficou discreta de propósito no tema, e sem isso as
            colunas da direita simplesmente não eram encontradas.

            Cartões e controles são exceção — ver `SELETOR_INTERATIVO`.
          */}
          <div {...rolagem} className="flex cursor-grab items-start gap-3 overflow-x-auto pb-4">
            {colunasVisiveis.map((coluna, indice) => (
              <Coluna
                key={coluna.etapa.id}
                id={coluna.etapa.id}
                nome={coluna.etapa.nome}
                indice={indice}
                clientes={coluna.clientes}
                total={coluna.valorEmAberto}
                etapas={colunas.map((c) => c.etapa)}
                etiquetas={etiquetas}
                aoTrocarEtapa={mover}
                aoAbrir={setAbertoId}
              />
            ))}
          </div>

          {totalVisivel === 0 && (
            <p className="text-muted-foreground px-4 pb-3 text-sm">
              Nenhum cartão encontrado com estes filtros.
            </p>
          )}
        </div>

        {/*
          O cartão que segue o cursor. A leve inclinação é o truque que dá
          sensação de peso ao gesto — sem ela, o cartão parece deslizar sobre
          vidro em vez de estar sendo carregado.
        */}
        <DragOverlay>
          {arrastando && (
            <div className="bg-card w-72 rotate-2 rounded-lg border p-3 shadow-(--sombra-media)">
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
          aoRemoverDoFunil={() => remover(aberto.cliente.id)}
          aoFechar={() => setAbertoId(null)}
        />
      )}
    </div>
  );
}

type FiltroRapido = 'todos' | 'atrasados' | 'propostas';

type AcaoOtimistaFunil =
  { tipo: 'mover'; clienteId: string; etapaId: string } | { tipo: 'remover'; clienteId: string };

const FILTROS_RAPIDOS: { valor: FiltroRapido; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'atrasados', rotulo: 'Parados' },
  { valor: 'propostas', rotulo: 'Com proposta' },
];

function filtrarColunas(
  colunas: QuadroFunil['colunas'],
  busca: string,
  filtro: FiltroRapido,
): QuadroFunil['colunas'] {
  const termo = normalizar(busca);

  return colunas.map((coluna) => ({
    ...coluna,
    clientes: coluna.clientes.filter((cliente) => {
      if (filtro === 'atrasados' && !cliente.parado) {
        return false;
      }

      if (filtro === 'propostas' && !cliente.orcamentoAberto) {
        return false;
      }

      if (!termo) return true;

      return normalizar(
        [
          cliente.nome,
          cliente.telefone,
          cliente.email,
          cliente.origem,
          cliente.etiquetas.map((etiqueta) => etiqueta.nome).join(' '),
          cliente.orcamentoAberto?.servicoNome,
        ]
          .filter(Boolean)
          .join(' '),
      ).includes(termo);
    }),
  }));
}

function Metrica({
  icone: Icone,
  rotulo,
  valor,
  detalhe,
  alerta = false,
}: {
  icone: typeof CircleDollarSign;
  rotulo: string;
  valor: string;
  detalhe: string;
  alerta?: boolean;
}) {
  return (
    <div className="bg-card flex min-h-28 items-start justify-between gap-4 rounded-xl border p-4 shadow-(--sombra-sutil)">
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs font-medium">{rotulo}</p>
        <p className="mt-2 truncate text-2xl font-semibold tracking-tight tabular-nums">{valor}</p>
        <p className="text-muted-foreground mt-1 truncate text-xs">{detalhe}</p>
      </div>
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg',
          alerta ? 'bg-atencao-suave text-atencao' : 'bg-primary/10 text-primary',
        )}
      >
        <Icone aria-hidden className="size-4" />
      </span>
    </div>
  );
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}
