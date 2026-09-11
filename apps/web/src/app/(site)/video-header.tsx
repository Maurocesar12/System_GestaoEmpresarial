import styles from './hero.module.css';

/**
 * O vídeo que ocupa o hero inteiro, por trás do texto.
 *
 * Vai atrás de tudo, e não num quadro no canto: quem chega vê o movimento
 * antes de ler a primeira linha, e o texto continua sendo o assunto.
 *
 * ## O que sustenta a legibilidade
 *
 * A gravação tem fundo preto e o site é claro. Em vez de reeditar o arquivo,
 * o CSS inverte o vídeo (detalhe em `hero.module.css`) e o véu faz o resto em
 * duas camadas: uma horizontal, que mantém a coluna do texto quase opaca, e
 * uma vertical, que devolve fundo sólido embaixo, onde ficam os atalhos. No
 * celular o véu é quase inteiro — lá o texto cobre a largura toda.
 *
 * ## Movimento
 *
 * `autoPlay muted loop playsInline` é o que faz o vídeo rodar sozinho em
 * qualquer navegador, inclusive no iOS (sem `playsInline` ele abre em tela
 * cheia). `aria-hidden` porque é decoração: não há informação aqui que não
 * esteja escrita ao lado.
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
