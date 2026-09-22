import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ComponentType } from 'react';
import { Github, Instagram, Link as LinkIcon, Linkedin, Mail, MapPin, Phone, UserRound } from 'lucide-react';
import type { Locale } from '@/i18n/routing';
import { getProfile, listExperiences } from '@/lib/db/profile';
import { pickLocale } from '@/lib/locale';
import { splitName } from '@/lib/format';
import { emailUrl, safeUrl } from '@/lib/urls';
import { describeSocialLink, isExternalHref, type ContactLinkKind } from '@/lib/contact-links';
import { pageMetadata } from '@/lib/metadata';
import { breadcrumbSchema, personSchema } from '@/lib/structured-data';
import { Container } from '@/components/container';
import { LineIcon } from '@/components/brand-icons';
import { CopyValue } from '@/components/copy-email';
import { ResumeLink } from '@/components/resume-link';
import { JsonLd } from '@/components/json-ld';
import { PwaRegister } from '@/app/offline/pwa-register';
import { ContactForm } from './contact-form';
type Props = { params: Promise<{ locale: Locale }> };

/** Only the size is set from here, so a hand-drawn mark can stand beside the lucide ones. */
type IconComponent = ComponentType<{ size?: number }>;
const icons: Record<ContactLinkKind, IconComponent> = {
  email: Mail, phone: Phone, line: LineIcon, instagram: Instagram, linkedin: Linkedin, github: Github, x: LinkIcon, link: LinkIcon,
};
const defaultLabels: Partial<Record<ContactLinkKind, string>> = { line: 'LINE', instagram: 'Instagram', linkedin: 'LinkedIn', github: 'GitHub', x: 'X' };

type Item = { key: string; label: string; value: string; Icon: IconComponent; href?: string; note?: string; copyValue?: string; copyLabel?: string };

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

  // Everything below comes from the database. Who and where come first, because a stranger reading
  // this page wants to know whose page it is and whether we are in the same part of the world before
  // any of it is worth acting on; then the email, then social_links in sort order.
  const { name, nickname } = splitName(p.name);
  const items: Item[] = [];
  if (name) items.push({ key: 'name', label: t('nameRow'), value: name, note: nickname, Icon: UserRound });
  if (region) items.push({ key: 'region', label: t('region'), value: region, Icon: MapPin });
  if (email) items.push({ key: 'email', label: site('email'), value: profile.email, href: email, Icon: Mail, copyValue: profile.email, copyLabel: t('copyEmail') });
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
    name, alternateName: nickname, locale, jobTitle: p.headline, description: p.bio, email: profile.email, image: profile.avatar_url,
    sameAs: profile.social_links.map(link => safeUrl(link.url)),
    alumniOf: experiences.filter(row => row.kind === 'education').map(row => pickLocale(row, locale).org),
  });
  const crumbs = breadcrumbSchema([{ name: site('brand'), path: `/${locale}` }, { name: t('title'), path: `/${locale}/contact` }]);
  return <Container className="page contact-page"><JsonLd nodes={[person, crumbs]} /><PwaRegister />
    <header className="page-heading contact-page-heading">
      <div>
        <h1>{t('title')}</h1>
        <p>{t('description')}</p>
      </div>
      <ResumeLink profile={profile} locale={locale} />
    </header>
    <div className="contact-grid">
      <section className="contact-details" aria-labelledby="contact-details-heading">
        <h2 id="contact-details-heading" className="contact-column-heading">{t('detailsTitle')}</h2>
        {items.length === 0 ? <p className="text-graphite">{site('contactUnavailable')}</p> : <dl className="contact-list">
          {items.map(item => {
            const { Icon } = item;
            const external = item.href ? isExternalHref(item.href) : false;
            return <div key={item.key} className="contact-list-row">
              {/* The icon is the label. It carries the name for a screen reader in text beside it and
                  for a pointer in the tooltip, so nothing is lost by not printing it. */}
              <dt title={item.label}>
                <span className="contact-icon" aria-hidden="true"><Icon size={21} /></span>
                <span className="sr-only">{item.label}</span>
              </dt>
              <dd>
                {item.href
                  ? <a href={item.href} className="contact-value-link" target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>{item.value}</a>
                  : <span className="contact-value">{item.value}</span>}
                {item.note ? <span className="contact-alias">({item.note})</span> : null}
                {item.copyValue ? <CopyValue compact value={item.copyValue} label={item.copyLabel || t('copyValue')} copiedLabel={t('copied')} /> : null}
              </dd>
            </div>;
          })}
        </dl>}
      </section>
      <section className="contact-form-panel" aria-labelledby="contact-form-heading" data-print="hide">
        <h2 id="contact-form-heading" className="contact-column-heading">{t('form.title')}</h2>
        <p className="contact-form-intro">{t('form.intro')}</p>
        {/* Server-rendered clock so the form also submits without JavaScript; the client replaces it on mount. */}
        <ContactForm startedAt={String(Date.now())} />
      </section>
    </div>
  </Container>;
}
