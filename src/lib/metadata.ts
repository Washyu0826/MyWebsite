import type { Metadata } from 'next';
import type { Locale } from '@/i18n/routing';
import { isDemoMode } from '@/lib/db/config';
export const SITE_NAME = 'Kuan-Yu Hsien';
export function pageMetadata(locale: Locale, path: string, title: string, description: string, image?: string | null): Metadata {
  const url = `/${locale}${path}`;
  return {
    title, description,
    // x-default deliberately points at the locale-less root: naming /zh here would make the zh
    // canonical a member of its own hreflang set, which Lighthouse reports as a broken canonical.
    alternates: { canonical: url, languages: { 'zh-TW': `/zh${path}`, en: `/en${path}`, 'x-default': path || '/' } },
    openGraph: {
      title, description, url, siteName: SITE_NAME, type: 'website', locale: locale === 'zh' ? 'zh_TW' : 'en_US',
      ...(image ? { images: [{ url: image, alt: title }] } : {}),
    },
    twitter: { card: 'summary_large_image', title, description, ...(image ? { images: [image] } : {}) },
    robots: isDemoMode() ? { index: false, follow: false } : undefined,
  };
}
