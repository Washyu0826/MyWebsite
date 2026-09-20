import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Github, Instagram, Link as LinkIcon, Linkedin, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import type { Locale } from '@/i18n/routing';
import { getProfile, listExperiences } from '@/lib/db/profile';
import { pickLocale } from '@/lib/locale';
import { emailUrl, safeUrl } from '@/lib/urls';
import { describeSocialLink, isExternalHref, type ContactLinkKind } from '@/lib/contact-links';
import { pageMetadata } from '@/lib/metadata';
import { breadcrumbSchema, personSchema } from '@/lib/structured-data';
import { Container } from '@/components/container';
import { CopyValue } from '@/components/copy-email';
import { ResumeLink } from '@/components/resume-link';
import { JsonLd } from '@/components/json-ld';
import { PwaRegister } from '@/app/offline/pwa-register';
import { ContactForm } from './contact-form';
type Props = { params: Promise<{ locale: Locale }> };

const icons: Record<ContactLinkKind, typeof Mail> = {
  email: Mail, phone: Phone, line: MessageCircle, instagram: Instagram, linkedin: Linkedin, github: Github, x: LinkIcon, link: LinkIcon,
};
const defaultLabels: Partial<Record<ContactLinkKind, string>> = { line: 'LINE', instagram: 'Instagram', linkedin: 'LinkedIn', github: 'GitHub', x: 'X' };

type Item = { key: string; label: string; value: string; Icon: typeof Mail; href?: string; copyValue?: string; copyLabel?: string };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Contact' });
  return pageMetadata(locale, '/contact', t('title'), t('description'));
}
export default async function Contact({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [profile, experiences, t, site] = await Promise.all([getProfile(), listExperiences(), getTranslations('Contact'), getTranslations('Site')]);
  const p = pickLocale(profile, locale);
  const email = emailUrl(profile.email);
  const region = (locale === 'en' ? profile.location_en : profile.location_zh)?.trim();
  const copyLabels: Partial<Record<ContactLinkKind, string>> = {
    email: t('copyEmail'), phone: t('copyPhone'), linkedin: t('copyLink'), github: t('copyLink'), link: t('copyLink'),
  };

  // Everything below comes from the database: profile.email / location, then social_links in sort order.
  const items: Item[] = [];
  if (email) items.push({ key: 'email', label: site('email'), value: profile.email, href: email, Icon: Mail, copyValue: profile.email, copyLabel: t('copyEmail') });
  if (region) items.push({ key: 'region', label: t('region'), value: region, Icon: MapPin });
  for (const row of profile.social_links) {
    const link = describeSocialLink(row);
    if (!link || (link.kind === 'email' && email)) continue;
    items.push({
      key: link.key,
      label: link.label || defaultLabels[link.kind] || (link.kind === 'phone' ? t('phone') : row.platform),
      value: link.display, href: link.href, Icon: icons[link.kind],
      copyValue: link.copyValue, copyLabel: copyLabels[link.kind] || t('copyValue'),
    });
  }

  // The homepage renders the same @id; both describe one person, so a crawler merges them.
  const person = personSchema({
    name: p.name, locale, jobTitle: p.headline, description: p.bio, email: profile.email, image: profile.avatar_url,
    sameAs: profile.social_links.map(link => safeUrl(link.url)),
    alumniOf: experiences.filter(row => row.kind === 'education').map(row => pickLocale(row, locale).org),
  });
  const crumbs = breadcrumbSchema([{ name: site('brand'), path: `/${locale}` }, { name: t('title'), path: `/${locale}/contact` }]);
  return <Container className="page contact-page"><JsonLd nodes={[person, crumbs]} /><PwaRegister /><header className="page-heading contact-page-heading"><h1>{t('title')}</h1><p>{t('description')}</p></header>
    <section className="contact-intro">
      <div>
        <p className="text-meta text-graphite">{p.name}</p>
        <h2 className="text-h2">{t('intro')}</h2>
        <p className="mt-4 text-graphite">{t('body')}</p>
      </div>
      <div className="contact-intro-actions">
        {email ? <a className="contact-direct-link" href={email}><Mail size={18} aria-hidden="true" />{site('email')}</a> : null}
        <ResumeLink profile={profile} locale={locale} />
      </div>
    </section>
    {items.length === 0 ? <p className="text-graphite">{site('contactUnavailable')}</p> : <dl className="contact-list">
      {items.map(item => {
        const { Icon } = item;
        const external = item.href ? isExternalHref(item.href) : false;
        const value = item.href
          ? <a href={item.href} className="contact-value-link" target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>{item.value}</a>
          : <span>{item.value}</span>;
        return <div key={item.key} className="contact-list-row">
          <dt><Icon size={18} aria-hidden="true" /><span>{item.label}</span></dt>
          <dd>
            <div className="contact-value">{value}</div>
            {item.copyValue ? <CopyValue value={item.copyValue} label={item.copyLabel || t('copyValue')} copiedLabel={t('copied')} /> : null}
          </dd>
        </div>;
      })}
    </dl>}
    <section className="mt-16" aria-labelledby="contact-form-heading" data-print="hide">
      <h2 id="contact-form-heading" className="text-h2">{t('form.title')}</h2>
      <p className="mt-4 mb-8 max-w-[60ch] text-graphite">{t('form.intro')}</p>
      {/* Server-rendered clock so the form also submits without JavaScript; the client replaces it on mount. */}
      <ContactForm startedAt={String(Date.now())} />
    </section>
  </Container>;
}
