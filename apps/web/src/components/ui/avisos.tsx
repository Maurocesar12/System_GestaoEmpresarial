'use client';

import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';

type TomAviso = 'sucesso' | 'erro' | 'atencao' | 'info';

interface Aviso {
  id: number;
  tom: TomAviso;
  mensagem: string;
}

/**
 * Quanto tempo um aviso fica na tela.
 *
 * Erro dura mais que sucesso, e não some sozinho quando exige leitura: "salvo"
 * é confirmação de algo que a pessoa acabou de fazer e já espera; uma falha ela
 * precisa ler, entender e às vezes copiar.
 */
const DURACAO: Record<TomAviso, number> = {
  sucesso: 3500,
  info: 4500,
  atencao: 6000,
  erro: 8000,
};

const ICONE: Record<TomAviso, typeof CheckCircle2> = {
  sucesso: CheckCircle2,
  erro: XCircle,
  atencao: TriangleAlert,
  info: Info,
};

const ESTILO: Record<TomAviso, string> = {
  sucesso: 'border-sucesso/30 bg-sucesso-suave text-sucesso',
  erro: 'border-destructive/30 bg-destrutivo-suave text-destructive',
  atencao: 'border-atencao/30 bg-atencao-suave text-atencao',
  info: 'border-info/30 bg-info-suave text-info',
};

interface ContextoAvisos {
  avisar: (tom: TomAviso, mensagem: string) => void;
}

const Contexto = createContext<ContextoAvisos | null>(null);

/**
 * Avisos temporários no canto da tela.
 *
 * ## Por que existe
 *
 * Antes, toda confirmação de ação era invisível: dar baixa num lançamento,
 * mover um cliente no funil e excluir uma categoria simplesmente aconteciam, e
 * a única pista era a lista mudar. Quando dava errado, a mensagem aparecia num
 * bloco fixo que a pessoa podia nem estar olhando.
 *
 * ## Por que sem biblioteca
 *
 * São ~90 linhas e nenhuma dependência nova. Uma biblioteca de toast traria
 * portal, animação e fila próprios — coisas que já temos no sistema — e mais
 * JavaScript para toda página carregar.
 *
 * ## Acessibilidade
 *
 * A região é `aria-live="polite"`, então o leitor de tela anuncia a mensagem
 * quando terminar o que está lendo, sem interromper. Erros usam `assertive`,
 * porque aí interromper é o certo. Cada aviso tem botão de fechar: sumir
 * sozinho é conveniência, não pode ser a única saída para quem lê devagar.
 */
export function ProvedorDeAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const proximoId = useRef(0);

  const avisar = useCallback((tom: TomAviso, mensagem: string) => {
    const id = proximoId.current++;
    setAvisos((atuais) => [...atuais, { id, tom, mensagem }]);
  }, []);

  const fechar = useCallback((id: number) => {
    setAvisos((atuais) => atuais.filter((aviso) => aviso.id !== id));
  }, []);

  const valor = useMemo(() => ({ avisar }), [avisar]);

  return (
    <Contexto.Provider value={valor}>
      {children}

      {/*
        `pointer-events-none` no contêiner e `auto` em cada aviso: assim a
        coluna vazia não bloqueia cliques na página por baixo, mas o botão de
        fechar continua clicável.
      */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
        role="region"
        aria-label="Notificações"
      >
        {avisos.map((aviso) => (
          <CartaoAviso key={aviso.id} aviso={aviso} aoFechar={() => fechar(aviso.id)} />
        ))}
      </div>
    </Contexto.Provider>
  );
}

function CartaoAviso({ aviso, aoFechar }: { aviso: Aviso; aoFechar: () => void }) {
  const Icone = ICONE[aviso.tom];

  useEffect(() => {
    const relogio = setTimeout(aoFechar, DURACAO[aviso.tom]);
    return () => clearTimeout(relogio);
  }, [aviso.tom, aoFechar]);

  return (
    <div
      role={aviso.tom === 'erro' ? 'alert' : 'status'}
      aria-live={aviso.tom === 'erro' ? 'assertive' : 'polite'}
      className={cn(
        'pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm shadow-[var(--sombra-media)]',
        'animate-in slide-in-from-bottom-2 fade-in duration-200',
        ESTILO[aviso.tom],
      )}
    >
      <Icone aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p className="flex-1">{aviso.mensagem}</p>

      <button
        type="button"
        onClick={aoFechar}
        aria-label="Fechar aviso"
        className="-m-1 shrink-0 rounded p-1 opacity-60 transition-opacity hover:opacity-100"
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </div>
  );
}

/**
 * Dispara avisos de dentro de um componente de cliente.
 *
 * Fora do provedor devolve uma função vazia em vez de estourar: um componente
 * usado numa tela sem o provedor deixa de avisar, mas não quebra a página.
 */
export function useAvisos(): ContextoAvisos {
  return useContext(Contexto) ?? { avisar: () => {} };
}
