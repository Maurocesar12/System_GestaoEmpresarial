'use client';

import {
  ArrowRight,
  Boxes,
  ChevronDown,
  Lightbulb,
  Search,
  TrendingUp,
  Users,
  Wallet,
  Calculator,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { estilosBotao } from '@/components/ui/botao';
import { estilosControle } from '@/components/ui/campo';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import {
  CATEGORIAS,
  normalizarParaBusca,
  type CategoriaConceito,
  type Conceito,
} from '@/lib/glossario';
import { cn } from '@/lib/utils';

export type ConceitoComId = Conceito & { id: string };

const ICONE_DA_CATEGORIA: Record<CategoriaConceito, LucideIcon> = {
  caixa: Wallet,
  custos: Calculator,
  vendas: TrendingUp,
  clientes: Users,
  estoque: Boxes,
};

type Filtro = CategoriaConceito | 'todas';

/**
 * A âncora da URL, lida como uma fonte externa.
 *
 * `useSyncExternalStore` em vez de `useEffect` + estado: no servidor o
 * `snapshot` é vazio e, depois da hidratação, o React troca para o valor real
 * sem acusar divergência. Ler `location.hash` direto no `useState` produziria
 * HTML diferente no servidor e no cliente.
 *
 * É isso que faz `/painel/ajuda#margem` — o link do "Ver no glossário" — abrir
 * o cartão certo.
 */
function assinarAncora(aoMudar: () => void) {
  window.addEventListener('hashchange', aoMudar);
  return () => window.removeEventListener('hashchange', aoMudar);
}

// Os ids do glossário são ASCII: não há o que decodificar, e `decodeURIComponent`
// lança exceção com uma âncora malformada digitada na barra de endereço.
const lerAncora = () => window.location.hash.slice(1);
const ancoraNoServidor = () => '';

interface EstadoDeToggles {
  /** A âncora a que os toggles pertencem. Âncora nova zera a lista. */
  ancora: string;
  alternados: ReadonlySet<string>;
}

/**
 * Glossário navegável: busca, categorias e cartões que abrem e fecham.
 *
 * ## Quem está aberto
 *
 * O cartão da âncora da URL nasce aberto; todos os outros, fechados. Clicar
 * **inverte** o estado do cartão — por isso o que se guarda é o conjunto dos que
 * o usuário alternou, e não dos que estão abertos. Assim o cartão da âncora pode
 * ser fechado com um clique, sem brigar com a URL.
 *
 * Quando a âncora muda (clicando num atalho "Saldo = Entradas − Saídas", por
 * exemplo), os toggles antigos deixam de valer: aquele cartão que o usuário
 * fechou há pouco não deve reabrir por causa de uma regra que ele nem lembra.
 * A lista é guardada junto da âncora a que pertence, e é descartada quando as
 * duas se separam — sem `useEffect`, só derivando.
 */
export function ExploradorGlossario({ conceitos }: { conceitos: ConceitoComId[] }) {
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [toggles, setToggles] = useState<EstadoDeToggles>({
    ancora: '',
    alternados: new Set(),
  });

  const ancora = useSyncExternalStore(assinarAncora, lerAncora, ancoraNoServidor);
  const alternados = toggles.ancora === ancora ? toggles.alternados : new Set<string>();

  const indexados = useMemo(
    () =>
      conceitos.map((conceito) => ({
        conceito,
        texto: normalizarParaBusca(
          [conceito.titulo, conceito.resumo, ...(conceito.busca ?? [])].join(' '),
        ),
      })),
    [conceitos],
  );

  // Cada palavra da busca precisa aparecer: "custo dia" acha "Custo por dia".
  const palavras = normalizarParaBusca(busca).split(/\s+/).filter(Boolean);

  const daBusca = indexados.filter(({ texto }) =>
    palavras.every((palavra) => texto.includes(palavra)),
  );

  const visiveis = daBusca.filter(
    ({ conceito }) => filtro === 'todas' || conceito.categoria === filtro,
  );

  function contar(categoria: Filtro) {
    return categoria === 'todas'
      ? daBusca.length
      : daBusca.filter(({ conceito }) => conceito.categoria === categoria).length;
  }

  function alternar(id: string) {
    setToggles((atual) => {
      const base = atual.ancora === ancora ? atual.alternados : new Set<string>();
      const proximo = new Set(base);

      if (!proximo.delete(id)) {
        proximo.add(id);
      }

      return { ancora, alternados: proximo };
    });
  }

  function limpar() {
    setBusca('');
    setFiltro('todas');
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <input
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            aria-label="Buscar um termo"
            placeholder="Procure um termo: margem, saldo, ticket médio…"
            className={cn(estilosControle, 'h-10 pl-9')}
          />
        </div>

        <div role="group" aria-label="Filtrar por assunto" className="flex flex-wrap gap-2">
          <Chip ativo={filtro === 'todas'} aoClicar={() => setFiltro('todas')}>
            Todos <Contagem total={contar('todas')} />
          </Chip>

          {CATEGORIAS.map((categoria) => (
            <Chip
              key={categoria.id}
              ativo={filtro === categoria.id}
              aoClicar={() => setFiltro(categoria.id)}
            >
              {categoria.rotulo} <Contagem total={contar(categoria.id)} />
            </Chip>
          ))}
        </div>
      </div>

      {/* Quem usa leitor de tela precisa saber que a lista mudou ao digitar. */}
      <p role="status" className="text-muted-foreground text-xs">
        {visiveis.length === 1 ? '1 termo' : `${visiveis.length} termos`}
      </p>

      {visiveis.length === 0 ? (
        <EstadoVazio
          icone={Search}
          titulo="Nenhum termo encontrado"
          descricao="Tente outra palavra, por exemplo “lucro”, “caixa” ou “estoque”, ou volte à lista completa."
          acao={
            <button
              type="button"
              onClick={limpar}
              className={estilosBotao({ variante: 'secundario', tamanho: 'sm' })}
            >
              Ver todos os termos
            </button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {visiveis.map(({ conceito }) => (
            <CartaoDoConceito
              key={conceito.id}
              conceito={conceito}
              aberto={(conceito.id === ancora) !== alternados.has(conceito.id)}
              aoAlternar={() => alternar(conceito.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Contagem({ total }: { total: number }) {
  return <span className="text-muted-foreground tabular-nums">({total})</span>;
}

function Chip({
  ativo,
  aoClicar,
  children,
}: {
  ativo: boolean;
  aoClicar: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={ativo}
      className={cn(
        'rounded-full border px-3 py-1.5 text-sm font-medium',
        ativo
          ? 'border-primary bg-primary text-primary-foreground [&_span]:text-primary-foreground/70'
          : 'bg-card hover:bg-accent text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function CartaoDoConceito({
  conceito,
  aberto,
  aoAlternar,
}: {
  conceito: ConceitoComId;
  aberto: boolean;
  aoAlternar: () => void;
}) {
  const Icone = ICONE_DA_CATEGORIA[conceito.categoria];
  const idPainel = `glossario-${conceito.id}`;
  const categoria = CATEGORIAS.find((item) => item.id === conceito.categoria)?.rotulo;

  return (
    <li
      id={conceito.id}
      // `target:` acende o cartão que veio da âncora da URL — sem JavaScript.
      className="bg-card target:ring-primary/30 scroll-mt-4 rounded-lg border shadow-(--sombra-sutil) target:ring-2"
    >
      <h3>
        <button
          type="button"
          onClick={aoAlternar}
          aria-expanded={aberto}
          aria-controls={idPainel}
          className="hover:bg-accent/40 flex w-full items-start gap-3 rounded-lg p-4 text-left"
        >
          <span className="bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
            <Icone aria-hidden className="size-4" />
          </span>

          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-semibold">{conceito.titulo}</span>
            <span className="text-muted-foreground text-sm leading-snug">{conceito.resumo}</span>
          </span>

          <ChevronDown
            aria-hidden
            className={cn(
              'text-muted-foreground mt-1.5 size-4 shrink-0 transition-transform',
              aberto && 'rotate-180',
            )}
          />
        </button>
      </h3>

      {/*
        A altura anima por `grid-template-rows` (0fr → 1fr): é a forma de animar
        "de zero até a altura do conteúdo" sem medir nada em JavaScript. O
        `inert` tira o conteúdo recolhido da ordem de tabulação e da leitura —
        sem ele, os links de um cartão fechado continuariam focáveis.
      */}
      <div
        id={idPainel}
        inert={!aberto}
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
          aberto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-4 border-t px-4 py-4 sm:pl-[3.75rem]">
            {conceito.comoCalcula && (
              <Bloco titulo="Como é calculado">{conceito.comoCalcula}</Bloco>
            )}
            {conceito.comoLer && <Bloco titulo="Como ler este número">{conceito.comoLer}</Bloco>}

            {conceito.exemplo && (
              <div className="bg-muted/60 flex gap-2.5 rounded-md p-3">
                <Lightbulb aria-hidden className="text-atencao mt-0.5 size-4 shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs font-semibold">Exemplo</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {conceito.exemplo}
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground text-xs">{categoria}</span>

              {conceito.onde && (
                <Link
                  href={conceito.onde.href}
                  className="text-primary inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
                >
                  Ver em {conceito.onde.rotulo}
                  <ArrowRight aria-hidden className="size-3.5" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold">{titulo}</p>
      <p className="text-muted-foreground text-sm leading-relaxed">{children}</p>
    </div>
  );
}
