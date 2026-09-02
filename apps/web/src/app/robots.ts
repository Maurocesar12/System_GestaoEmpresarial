import type { MetadataRoute } from 'next';
import { SITE } from '@/configuracao/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/painel', '/entrar', '/cadastro', '/sair'],
    },
    sitemap: new URL('/sitemap.xml', SITE.url).toString(),
  };
}
