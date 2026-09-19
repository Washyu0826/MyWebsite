import type { MetadataRoute } from 'next';
import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';

// One manifest for the whole origin, so it speaks the default locale.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations({ locale: routing.defaultLocale, namespace: 'Manifest' });
  return {
    name: t('name'),
    short_name: t('shortName'),
    description: t('description'),
    id: '/',
    start_url: `/${routing.defaultLocale}`,
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'zh-TW',
    dir: 'ltr',
    categories: ['portfolio', 'productivity'],
    background_color: '#0D0E10',
    theme_color: '#0D0E10',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
