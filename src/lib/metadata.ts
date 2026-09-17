import type { Metadata } from 'next';
import type { Locale } from '@/i18n/routing';
import { isDemoMode } from '@/lib/db/config';
export function pageMetadata(locale: Locale, path: string, title: string, description: string): Metadata {
  return {
    title, description,
    alternates: { canonical: `/${locale}${path}`, languages: { 'zh-TW': `/zh${path}`, en: `/en${path}`, 'x-default': `/zh${path}` } },
    openGraph: { title, description, type: 'website', locale: locale === 'zh' ? 'zh_TW' : 'en_US' },
    robots: isDemoMode() ? { index: false, follow: false } : undefined,
  };
}
