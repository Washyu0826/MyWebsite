import { ImageResponse } from 'next/og';
import type { Locale } from '@/i18n/routing';
import { getPostBySlug } from '@/lib/db/posts';
import { pickLocale } from '@/lib/locale';
import { SITE_NAME } from '@/lib/metadata';
import { OG_SIZE, OgCard } from '@/components/og-card';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = SITE_NAME;
export default async function Image({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params;
  let title = SITE_NAME, footer: string | undefined;
  try {
    const post = await getPostBySlug(slug);
    if (post) { const p = pickLocale(post, locale); title = p.title; footer = p.excerpt || undefined; }
  } catch { /* Fall back to the site name when the article cannot be loaded. */ }
  return new ImageResponse(<OgCard eyebrow={SITE_NAME} title={title} footer={footer?.slice(0, 90)} />, size);
}
