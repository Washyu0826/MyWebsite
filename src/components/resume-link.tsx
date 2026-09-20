import { getTranslations } from 'next-intl/server';
import type { VariantProps } from 'class-variance-authority';
import { resumeUrl } from '@/lib/urls';
import type { Profile } from '@/types/content';
import type { Locale } from '@/i18n/routing';
import { buttonVariants } from './ui/button';
type Props = {
  profile: Profile;
  locale: Locale;
  variant?: VariantProps<typeof buttonVariants>['variant'];
};
export async function ResumeLink({ profile, locale, variant = 'outline' }: Props) {
  const t = await getTranslations('Site');
  const href = resumeUrl(profile, locale);
  return <a className={buttonVariants({ variant })} href={href} download>{t('resume')}</a>;
}
