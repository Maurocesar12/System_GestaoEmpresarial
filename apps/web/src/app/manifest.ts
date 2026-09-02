import type { MetadataRoute } from 'next';
import { SITE } from '@/configuracao/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.nome,
    short_name: SITE.nomeCurto,
    description: SITE.descricao,
    lang: SITE.idioma,
    start_url: '/',
    display: 'standalone',
    background_color: SITE.corFundo,
    theme_color: SITE.corMarca,
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
