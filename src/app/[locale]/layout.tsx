import type { Metadata } from 'next';
import { Inter, Noto_Sans_TC, JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Providers } from '@/components/providers';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Container } from '@/components/container';
import { isDemoMode } from '@/lib/db/config';
import '../globals.css';
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
// One variable font covers 400/500/700 without repeating every CJK unicode range three times.
const noto = Noto_Sans_TC({ subsets: ['latin'], variable: '--font-noto', display: 'swap', preload: false });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap', preload: false });
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: { default: 'Kuan-Yu Hsien', template: '%s | Kuan-Yu Hsien' },
};
export function generateStaticParams() { return routing.locales.map(locale => ({ locale })); }
export default async function LocaleLayout({ children, params }: {
  children: React.ReactNode; params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('Site');
  return <html lang={locale === 'zh' ? 'zh-TW' : 'en'} suppressHydrationWarning>
    <body className={`${inter.variable} ${noto.variable} ${mono.variable} antialiased`}>
      <NextIntlClientProvider><Providers>
        <a href="#main-content" className="skip-link">{t('skip')}</a>
        <Header />
        {isDemoMode() && <aside className="demo-notice"><Container><strong>{t('demo')}</strong><span className="ml-3">{t('demoNote')}</span></Container></aside>}
        <main id="main-content" tabIndex={-1}>{children}</main>
        <Footer />
      </Providers></NextIntlClientProvider>
    </body>
  </html>;
}
