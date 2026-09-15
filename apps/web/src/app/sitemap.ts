import type { MetadataRoute } from 'next';
import { SITE } from '@/configuracao/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE.url.toString(),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: new URL('/privacidade', SITE.url).toString(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
