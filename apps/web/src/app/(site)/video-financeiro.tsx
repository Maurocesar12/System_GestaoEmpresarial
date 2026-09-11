'use client';

import { useEffect, useRef } from 'react';

/**
 * A gravação do gráfico financeiro, usada no hero e na seção de resultado.
 *
 * ## Por que é componente de cliente
 *
 * Por causa de `prefers-reduced-motion`. A primeira versão desligava o vídeo
 * no CSS quando a preferência estava ligada — e quem tem "reduzir animações"
 * no Windows (bem mais gente do que se imagina) via um hero **em branco**, sem
 * entender o que tinha sumido.
 *
 * A resposta certa não é esconder: é parar. Pausado, o vídeo continua sendo
 * uma imagem do gráfico na tela; o que desaparece é só o movimento, que era
 * exatamente o que a preferência pedia. E não custa um arquivo de pôster a
 * mais para baixar.
 *
 * O JavaScript aqui é o mínimo: ler a preferência e pausar. Sem estado, sem
 * re-render — o efeito mexe direto no elemento.
 */
export function VideoFinanceiro({ className }: { className: string }) {
  const referencia = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const consulta = window.matchMedia('(prefers-reduced-motion: reduce)');

    const aplicar = () => {
      const video = referencia.current;
      if (!video) return;

      if (consulta.matches) {
        video.pause();
      } else {
        // `play()` devolve promessa e rejeita se a aba estiver oculta ou se o
        // navegador recusar o autoplay. Ignorar é o certo: o vídeo é
        // decoração, e um erro no console não ajudaria ninguém.
        void video.play().catch(() => undefined);
      }
    };

    aplicar();
    consulta.addEventListener('change', aplicar);

    return () => consulta.removeEventListener('change', aplicar);
  }, []);

  return (
    <video
      ref={referencia}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden="true"
      className={className}
    >
      <source src="/media/header/financeiro.mp4" type="video/mp4" />
    </video>
  );
}
