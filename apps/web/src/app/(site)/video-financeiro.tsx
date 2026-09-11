/**
 * A gravação do gráfico financeiro, usada no hero e na seção de resultado.
 *
 * ## Sempre em movimento, por decisão de produto
 *
 * Houve uma versão que pausava o vídeo quando o sistema pedia menos animação
 * (`prefers-reduced-motion`). Ficou para trás a pedido: o movimento é o ponto
 * da peça, e parado ele vira uma imagem estática que não conta nada. Como a
 * gravação é muda, sem piscadas e em laço contínuo, o incômodo é pequeno perto
 * do que ela comunica.
 *
 * O efeito colateral bom é que o componente voltou a ser de servidor: **zero
 * JavaScript** para o navegador, só HTML.
 *
 * `autoPlay muted loop playsInline` é o que faz o vídeo rodar sozinho em
 * qualquer navegador — sem `playsInline` o iOS abre em tela cheia, e sem
 * `muted` nenhum navegador deixa iniciar sozinho. `aria-hidden` porque é
 * decoração: não há informação aqui que não esteja escrita ao lado.
 */
export function VideoFinanceiro({ className }: { className: string }) {
  return (
    <video
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
