# Vídeo para o header

`header-gestao-fullhd-hq.mp4`: 1920 × 1080, 30 fps, 12 segundos, H.264, sem áudio, loop contínuo. Renderização em 2× com redução Lanczos e compressão CRF 14 para preservar textos e gráficos. Paleta marfim, carvão e caramelo. Os dados e as notificações são ilustrativos.

`header-gestao-poster.jpg`: imagem de capa para exibir durante o carregamento.

A composição reserva aproximadamente o terço esquerdo para o título e os botões em HTML. Em celulares, prefira posicionar o vídeo abaixo do título; um recorte central pode esconder informações do painel.

## Exemplo de uso em React / Next.js

```tsx
<video
  autoPlay
  muted
  loop
  playsInline
  preload="metadata"
  poster="/media/header/header-gestao-poster.jpg"
  aria-hidden="true"
  className="header-video"
>
  <source src="/media/header/header-gestao-fullhd-hq.mp4" type="video/mp4" />
</video>
```

O header usa reprodução automática nativa, sem controles visíveis, conforme a configuração desejada. O navegador controla a disponibilidade de autoplay. O título e a chamada para ação continuam como texto HTML acessível.

## Editar e renderizar

O fonte está em `scripts/media/render-header.py`, na raiz do projeto. Usa Pillow, NumPy e imageio-ffmpeg (dependências somente da renderização). Execute `python scripts/media/render-header.py` para gerar os arquivos novamente. A opção `--poster-only` gera apenas as imagens de revisão.
