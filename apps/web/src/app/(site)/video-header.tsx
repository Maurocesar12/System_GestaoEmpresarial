import styles from './hero.module.css';
import { VideoFinanceiro } from './video-financeiro';

/**
 * O vídeo que ocupa o hero inteiro, por trás do texto.
 *
 * Vai atrás de tudo, e não num quadro no canto: quem chega vê o movimento
 * antes de ler a primeira linha, e o texto continua sendo o assunto.
 *
 * A gravação tem fundo preto e o site é claro. Em vez de reeditar o arquivo, o
 * CSS inverte o vídeo (detalhe em `hero.module.css`) e o véu faz o resto em
 * duas camadas: uma horizontal, que mantém a coluna do texto quase opaca, e
 * uma vertical, que devolve fundo sólido embaixo, onde ficam os atalhos. No
 * celular o véu é quase inteiro — lá o texto cobre a largura toda.
 */
export function VideoHeader() {
  return (
    <div className={styles['hero-fundo']} aria-hidden="true">
      <VideoFinanceiro className={styles['hero-fundo-video']!} />
      <span className={styles['hero-veu']} />
    </div>
  );
}
