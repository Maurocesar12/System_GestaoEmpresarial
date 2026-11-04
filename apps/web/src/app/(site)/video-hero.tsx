/**
 * O vídeo que passa por trás do hero, do topo da tela até o fim da seção.
 *
 * Fica atrás de tudo, e não num quadro: quem chega vê o movimento antes de
 * ler a primeira linha, e o texto continua sendo o assunto. O visual (filtro
 * preto e branco, véu de legibilidade) está em `site.css`, `.hero-video`.
 *
 * `autoPlay muted loop playsInline` é o que faz o vídeo rodar sozinho em
 * qualquer navegador: sem `playsInline` o iOS abre em tela cheia, e sem
 * `muted` nenhum navegador deixa iniciar sozinho. Continua rodando com
 * "reduzir animações" ligado, por decisão de produto já tomada antes: a
 * gravação é muda, sem piscadas e em laço contínuo. `aria-hidden` porque é
 * decoração — nada nele que não esteja escrito ao lado.
 *
 * Componente de servidor: nenhum JavaScript vai para o navegador.
 */
export function VideoHero() {
  return (
    <div className="hero-video" aria-hidden="true">
      <video autoPlay muted loop playsInline preload="metadata">
        <source src="/media/header/financeiro.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
