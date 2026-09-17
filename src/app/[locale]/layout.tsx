import type { Metadata } from 'next';
import { Inter, Noto_Sans_TC, JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { routing } from '@/i18n/routing';
import { Providers } from '@/components/providers';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Container } from '@/components/container';
import { isDemoMode } from '@/lib/db/config';
import { SITE_NAME } from '@/lib/metadata';
import '../globals.css';
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
// One variable font covers 400/500/700 without repeating every CJK unicode range three times.
const noto = Noto_Sans_TC({ subsets: ['latin'], variable: '--font-noto', display: 'swap', preload: false });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap', preload: false });
// Marks JS availability (and whether the intro already played this session) before first paint so the
// reveal animation can hide its lines without a flash; see [data-reveal] in layout.css.
const revealScript = "try{document.documentElement.dataset.js=sessionStorage.getItem('hsien-intro')?'seen':'1'}catch(e){document.documentElement.dataset.js='1'}";
type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale, namespace: 'Home' });
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
    title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
    description: t('description'),
  };
}
export function generateStaticParams() { return routing.locales.map(locale => ({ locale })); }
export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('Site');
  return <html lang={locale === 'zh' ? 'zh-TW' : 'en'} suppressHydrationWarning>
    <body className={`${inter.variable} ${noto.variable} ${mono.variable} antialiased`}>
      <script dangerouslySetInnerHTML={{ __html: revealScript }} />
      <NextIntlClientProvider><Providers>
        <a href="#main-content" className="skip-link">{t('skip')}</a>
        <Header />
        {isDemoMode() && <aside className="demo-notice"><Container><strong>{t('demo')}</strong><span className="ml-3">{t('demoNote')}</span></Container></aside>}
        <main id="main-content" tabIndex={-1}>{children}</main>
        <Footer />
      </Providers></NextIntlClientProvider>
      <Analytics />
      <SpeedInsights />
    </body>
  </html>;
}
