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
  ];
}
