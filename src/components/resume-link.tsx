import { getTranslations } from 'next-intl/server';
import { resumeUrl } from '@/lib/urls';
import type { Profile } from '@/types/content';
import type { Locale } from '@/i18n/routing';
import { buttonVariants } from './ui/button';
export async function ResumeLink({ profile, locale }: { profile: Profile; locale: Locale }) {
  const t = await getTranslations('Site');
  return resumeUrl(profile, locale)
    ? <a className={buttonVariants({ variant: 'outline' })} href={`/resume/${locale}.pdf`}>{t('resume')}</a>
    : <p className="text-meta text-graphite">{t('resumeUnavailable')}</p>;
}
