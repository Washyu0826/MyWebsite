import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
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
// No CJK webfont: Noto Sans TC shipped 105 subset files (4.0 MB) for glyphs every target OS already
// has. Han now falls through to the metric-matched local stack in styles/typography.css; Latin still
// comes from Inter, which has no Han coverage, so the split is decided by the font itself.
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap', preload: false });
// Marks JS availability (and whether the intro already played this session) before first paint so the
// reveal animation can hide its lines without a flash; see [data-reveal] in layout.css.
const revealScript = "try{document.documentElement.dataset.js=sessionStorage.getItem('hsien-intro')?'seen':'1'}catch(e){document.documentElement.dataset.js='1'}";
// viewport-fit=cover lets the page paint under the notch, so every edge-anchored element has to keep
// itself out of the inset. Inline because layout.css belongs to another workstream; nothing else here.
const safeAreaCss = `
.container { padding-left: max(20px, env(safe-area-inset-left)); padding-right: max(20px, env(safe-area-inset-right)); }
@media (min-width: 640px) { .container { padding-left: max(32px, env(safe-area-inset-left)); padding-right: max(32px, env(safe-area-inset-right)); } }
.site-header { padding-top: env(safe-area-inset-top); }
.site-footer { padding-bottom: env(safe-area-inset-bottom); }
.skip-link { top: max(12px, env(safe-area-inset-top)); left: max(20px, env(safe-area-inset-left)); }
`;
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
// viewport-fit=cover is required for env(safe-area-inset-*) to resolve to anything on iOS.
// No maximum-scale / user-scalable: browser zoom stays available (WCAG 1.4.4).
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };
export function generateStaticParams() { return routing.locales.map(locale => ({ locale })); }
export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('Site');
  // The font variables go on <html>, not <body>: :root declares --font-stack-sans in terms of
  // var(--font-inter), and a custom property is substituted where it is declared, so an --font-inter
  // that only exists on <body> would leave the whole stack invalid at :root.
  return <html lang={locale === 'zh' ? 'zh-TW' : 'en'} className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
    <body className="antialiased">
      <script dangerouslySetInnerHTML={{ __html: revealScript }} />
      <style dangerouslySetInnerHTML={{ __html: safeAreaCss }} />
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
