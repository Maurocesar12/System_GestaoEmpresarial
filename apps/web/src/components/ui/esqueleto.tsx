import { cn } from '@/lib/utils';

/**
 * Bloco cinza pulsante que ocupa o lugar do conteúdo enquanto ele carrega.
 *
 * ## Por que isto importa mais do que parece
 *
 * Toda leitura da API usa `cache: 'no-store'` — dado de empresa não pode entrar
 * em cache compartilhado. Sem um estado de carregamento, o App Router segura a
 * tela **anterior** até o servidor responder: a pessoa clica em "Clientes" e
 * continua vendo o painel, sem nenhum sinal de que algo está acontecendo. Parece
 * travado, e a reação natural é clicar de novo.
 *
 * Um `loading.tsx` troca isso por uma resposta imediata. O tempo até os dados
 * chegarem é o mesmo; o que muda é o sistema deixar de parecer quebrado.
 *
 * ## Por que imitar o formato do conteúdo
 *
 * O esqueleto reproduz a silhueta do que vem depois — mesma altura de linha,
 * mesmo número de colunas. Assim a tela não "pula" quando os dados chegam, e o
 * olho já sabe onde procurar antes de haver o que ler.
 *
 * `aria-hidden` porque não há informação aqui: quem usa leitor de tela é avisado
 * pelo `aria-busy` da região, não por uma sequência de caixas vazias.
 */
export function Esqueleto({ className }: { className?: string }) {
  return <div aria-hidden className={cn('bg-muted animate-pulse rounded-md', className)} />;
}

/** Linha de texto falsa. A largura varia para não parecer um código de barras. */
export function EsqueletoTexto({ className }: { className?: string }) {
  return <Esqueleto className={cn('h-4', className)} />;
}

/**
 * Envelope de uma área que está carregando.
 *
 * `aria-busy` e o texto escondido são o que comunica o carregamento a quem não
 * vê a animação. Sem isso, o leitor de tela anuncia uma página vazia.
 */
export function AreaCarregando({
  children,
  rotulo = 'Carregando',
}: {
  children: React.ReactNode;
  rotulo?: string;
}) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">{rotulo}…</span>
      {children}
    </div>
  );
}

/** Faixa de quatro indicadores, no mesmo grid do `FaixaDeIndicadores`. */
export function EsqueletoIndicadores({ quantidade = 4 }: { quantidade?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: quantidade }, (_, i) => (
        <div key={i} className="bg-card rounded-lg border p-4 shadow-[var(--sombra-sutil)]">
          <Esqueleto className="h-3 w-24" />
          <Esqueleto className="mt-2 h-7 w-32" />
          <Esqueleto className="mt-1.5 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Tabela falsa, dentro da moldura de cartão que a real vai ocupar. */
export function EsqueletoTabela({
  linhas = 6,
  colunas = 4,
}: {
  linhas?: number;
  colunas?: number;
}) {
  return (
    <div className="bg-card overflow-hidden rounded-lg border shadow-[var(--sombra-sutil)]">
      <div className="bg-muted/50 flex gap-4 border-b px-4 py-3">
        {Array.from({ length: colunas }, (_, i) => (
          <Esqueleto key={i} className="h-3 flex-1" />
        ))}
      </div>

      <div className="divide-y">
        {Array.from({ length: linhas }, (_, linha) => (
          <div key={linha} className="flex items-center gap-4 px-4 py-3.5">
            {Array.from({ length: colunas }, (_, coluna) => (
              <Esqueleto
                key={coluna}
                className={cn(
                  'h-4 flex-1',
                  // A primeira coluna costuma ser o nome, e nomes têm
                  // comprimentos diferentes. Variar aqui evita o efeito de
                  // grade perfeita, que não se parece com dado nenhum.
                  coluna === 0 && linha % 3 === 1 && 'max-w-[70%]',
                  coluna === 0 && linha % 3 === 2 && 'max-w-[85%]',
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Cabeçalho de tela: título, descrição e botão de ação. */
export function EsqueletoCabecalho({ comAcoes = true }: { comAcoes?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-2">
        <Esqueleto className="h-7 w-40" />
        <Esqueleto className="h-4 w-64" />
      </div>
      {comAcoes && <Esqueleto className="h-10 w-36" />}
    </div>
  );
}

/** Cartão com cabeçalho e uma lista curta — o formato dos blocos do painel. */
export function EsqueletoCartaoLista({ itens = 4 }: { itens?: number }) {
  return (
    <div className="bg-card rounded-lg border shadow-[var(--sombra-sutil)]">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <Esqueleto className="h-4 w-40" />
        <Esqueleto className="h-3 w-16" />
      </div>

      <div className="divide-y">
        {Array.from({ length: itens }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="flex flex-col gap-1.5">
              <Esqueleto className="h-4 w-36" />
              <Esqueleto className="h-3 w-24" />
            </div>
            <Esqueleto className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
