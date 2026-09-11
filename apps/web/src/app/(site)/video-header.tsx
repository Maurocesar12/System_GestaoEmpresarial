import styles from './hero.module.css';

/**
 * O vídeo que ocupa o hero inteiro, por trás do texto.
 *
 * É uma gravação real do financeiro — o produto se apresentando sozinho, sem
 * mockup. Por isso vai atrás de tudo, e não num quadrinho no canto: quem chega
 * vê o sistema funcionando antes de ler a primeira linha.
 *
 * ## O que sustenta a legibilidade
 *
 * A gravação é uma tela clara, e o texto do hero é escuro. Sem tratamento, o
 * título sumiria em cima de um cartão branco da gravação. O véu resolve isso
 * em duas camadas: uma horizontal, que mantém o lado do texto praticamente
 * opaco, e uma leve por cima de tudo, que tira o contraste do que está
 * passando. No celular o véu é quase sólido — lá o texto cobre a tela toda.
 *
 * ## Movimento
 *
 * `autoPlay muted loop playsInline` é o que faz o vídeo rodar sozinho em todos
 * os navegadores, inclusive no iOS (sem `playsInline` ele abre em tela cheia).
 * `aria-hidden` porque é decoração: não há informação aqui que não esteja
 * escrita ao lado.
 */
export function VideoHeader() {
  return (
    <div className={styles['hero-fundo']} aria-hidden="true">
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className={styles['hero-fundo-video']}
      >
        <source src="/media/header/financeiro.mp4" type="video/mp4" />
      </video>

      <span className={styles['hero-veu']} />
    </div>
  );
}
