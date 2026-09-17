import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from './container';
import { Navigation } from './navigation';
import { MobileMenu } from './mobile-menu';
import { ThemeSwitch } from './theme-switch';
export async function Header() {
  const t = await getTranslations('Site');
  return <header className="site-header"><Container className="header-inner">
    <Link href="/" className="brand"><span className="brand-mark" aria-hidden="true" />{t('brand')}</Link>
    <div className="flex items-center gap-2">
      <Suspense><nav className="hidden items-center gap-2 md:flex" aria-label={t('navigation')}><Navigation /></nav></Suspense>
      <ThemeSwitch /><Suspense><MobileMenu /></Suspense>
    </div>
  </Container></header>;
}
