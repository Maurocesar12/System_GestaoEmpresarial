'use client';

import { Pause, Play, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { cn } from '@/lib/utils';

/**
 * O relógio do painel.
 *
 * ## Por que recarregar a rota inteira
 *
 * `router.refresh()` refaz a requisição do lado do servidor e costura o
 * resultado na árvore que já está na tela: nada pisca, a rolagem fica onde
 * estava e o estado dos componentes de cliente sobrevive. A alternativa —
 * transformar o painel em componente de cliente e buscar por `fetch` — custaria
 * baixar toda a formatação de dinheiro e data para o navegador e reimplementar
 * ali o que o servidor já faz.
 *
 * ## Por que existe um botão de pausa
 *
 * A tela que se move sozinha atrapalha quem está lendo com calma ou mostrando
 * um número para outra pessoa. Quem pausa continua vendo o horário da última
 * leitura, então nunca confunde "parado" com "atualizado".
 *
 * ## Por que a aba escondida não atualiza
 *
 * Um painel esquecido aberto numa aba de fundo geraria requisições a cada meio
 * minuto, o dia inteiro, para ninguém. Ao voltar para a aba, a tela se atualiza
 * na hora — que é exatamente quando o dado volta a ser olhado.
 */
export function AtualizacaoAutomatica({
  geradoEm,
  intervaloSegundos,
}: {
  /** Instante em que o servidor leu os dados, em ISO. */
  geradoEm: string;
  intervaloSegundos: number;
}) {
  const router = useRouter();
  const [ativa, setAtiva] = useState(true);
  const [atualizando, iniciar] = useTransition();

  // O relógio guarda o instante atual, e a espera é **calculada na renderização**
  // a partir dele. Guardar os segundos já contados exigiria zerá-los dentro de
  // um efeito toda vez que `geradoEm` mudasse — estado derivado de outro
  // estado, que é justamente o que provoca renderização em cascata.
  //
  // O valor inicial é o próprio `geradoEm`, e não `Date.now()`: assim servidor
  // e navegador renderizam "agora" na primeira passada, sem divergir na
  // hidratação.
  const [agora, setAgora] = useState(() => new Date(geradoEm).getTime());

  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), 1_000);
    return () => clearInterval(relogio);
  }, []);

  const segundos = Math.max(0, Math.round((agora - new Date(geradoEm).getTime()) / 1_000));

  useEffect(() => {
    if (!ativa) return;

    const atualizar = () => {
      if (document.visibilityState !== 'visible') return;
      iniciar(() => router.refresh());
    };

    const ciclo = setInterval(atualizar, intervaloSegundos * 1_000);

    // Voltar para a aba é o momento em que o dado volta a importar: melhor uma
    // leitura imediata do que esperar o próximo ciclo mostrando número velho.
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') atualizar();
    };

    document.addEventListener('visibilitychange', aoVoltar);

    return () => {
      clearInterval(ciclo);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [ativa, intervaloSegundos, router]);

  return (
    <div className="flex items-center gap-2">
      <p className="text-muted-foreground text-xs" aria-live="off">
        {atualizando ? (
          'atualizando…'
        ) : (
          <>
            <span className="hidden sm:inline">atualizado </span>
            <span className="tabular-nums">{descreverEspera(segundos)}</span>
          </>
        )}
      </p>

      <button
        type="button"
        onClick={() => iniciar(() => router.refresh())}
        aria-label="Atualizar agora"
        className="hover:bg-accent text-muted-foreground hover:text-foreground rounded-md border p-2 transition-colors"
      >
        <RefreshCw aria-hidden className={cn('size-4', atualizando && 'animate-spin')} />
      </button>

      <button
        type="button"
        onClick={() => setAtiva((atual) => !atual)}
        aria-pressed={ativa}
        aria-label={
          ativa
            ? 'Pausar atualização automática'
            : `Retomar atualização automática a cada ${intervaloSegundos} segundos`
        }
        className={cn(
          'flex items-center gap-1.5 rounded-md border px-2.5 py-2 text-xs transition-colors',
          ativa
            ? 'text-muted-foreground hover:bg-accent hover:text-foreground'
            : 'border-atencao/30 bg-atencao-suave text-atencao',
        )}
      >
        {ativa ? (
          <Pause aria-hidden className="size-3.5" />
        ) : (
          <Play aria-hidden className="size-3.5" />
        )}
        <span className="hidden sm:inline">{ativa ? 'ao vivo' : 'pausado'}</span>
      </button>
    </div>
  );
}

function descreverEspera(segundos: number): string {
  if (segundos < 5) return 'agora';
  if (segundos < 60) return `há ${segundos}s`;

  const minutos = Math.floor(segundos / 60);
  return minutos < 60 ? `há ${minutos} min` : `há ${Math.floor(minutos / 60)} h`;
}
