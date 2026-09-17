import { ImageResponse } from 'next/og';
import type { Locale } from '@/i18n/routing';
import { getProfile } from '@/lib/db/profile';
import { pickLocale } from '@/lib/locale';
import { SITE_NAME } from '@/lib/metadata';
import { OG_SIZE, OgCard } from '@/components/og-card';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = SITE_NAME;
export default async function Image({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  let name = SITE_NAME, headline = '';
  try {
    const profile = pickLocale(await getProfile(), locale);
    name = profile.name || name; headline = profile.headline;
  } catch { /* Fall back to the static site name when profile data is unavailable. */ }
  return new ImageResponse(<OgCard eyebrow={SITE_NAME} title={headline || name} footer={headline ? name : undefined} />, size);
}
