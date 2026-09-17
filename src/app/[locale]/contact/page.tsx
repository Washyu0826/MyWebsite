import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { getProfile } from '@/lib/db/profile';
import { emailUrl, safeUrl } from '@/lib/urls';
import { pageMetadata } from '@/lib/metadata';
import { Container } from '@/components/container';
import { CopyEmail } from '@/components/copy-email';
import { ResumeLink } from '@/components/resume-link';
import { ContactForm } from './contact-form';
type Props = { params: Promise<{ locale: Locale }> };
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Contact' });
  return pageMetadata(locale, '/contact', t('title'), t('description'));
}
export default async function Contact({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [profile, t, site] = await Promise.all([getProfile(), getTranslations('Contact'), getTranslations('Site')]);
  const email = emailUrl(profile.email);
  return <Container className="page"><header className="page-heading"><h1>{t('title')}</h1><p>{t('description')}</p></header>
    <section className="mb-12 max-w-[68ch]"><h2 className="text-h2">{t('intro')}</h2><p className="mt-4 text-graphite">{t('body')}</p></section>
    <dl className="border-t border-rule">
      <div className="border-b border-rule py-6">
        <dt className="text-meta text-graphite">{site('email')}</dt>
        <dd className="flex flex-wrap items-center justify-between gap-5">{email ? <a href={email} className="text-link break-all text-h3">{profile.email}</a> : site('contactUnavailable')}
          {email && <CopyEmail email={profile.email} />}</dd>
      </div>
      {profile.social_links.filter(s => safeUrl(s.url)).map(s => <div key={s.id} className="grid gap-2 border-b border-rule py-5 sm:grid-cols-[160px_1fr]">
        <dt className="text-meta text-graphite">{s.label || s.platform}</dt><dd><a href={s.url} className="text-link break-all" target="_blank" rel="noopener noreferrer">{s.url.replace(/^https?:\/\//, '')}</a></dd>
      </div>)}
    </dl>
    <section className="mt-16" aria-labelledby="contact-form-heading">
      <h2 id="contact-form-heading" className="text-h2">{t('form.title')}</h2>
      <p className="mt-4 mb-8 max-w-[60ch] text-graphite">{t('form.intro')}</p>
      <ContactForm />
    </section>
    <section className="mt-16"><h2 className="mb-5 text-h2">{t('resumeTitle')}</h2><ResumeLink profile={profile} locale={locale} /></section>
  </Container>;
}
