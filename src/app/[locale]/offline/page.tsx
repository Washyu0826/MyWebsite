import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { Container } from '@/components/container';
import { PwaRegister } from '@/app/offline/pwa-register';
type Props = { params: Promise<{ locale: Locale }> };

// Precached by the service worker, so it must stay static: no database, no request-time data.
export function generateStaticParams() { return routing.locales.map(locale => ({ locale })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Offline' });
  return { title: t('title'), description: t('body'), robots: { index: false, follow: false } };
}
export default async function Offline({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Offline');
  return <Container className="page">
    <PwaRegister />
    <header className="page-heading"><h1>{t('title')}</h1><p>{t('body')}</p></header>
    <p className="max-w-[60ch] text-graphite">{t('hint')}</p>
    <p className="mt-8"><Link href="/" className="text-link">{t('home')}</Link></p>
  </Container>;
}
