import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { getProfile } from '@/lib/db/profile';
import { listSearchItems } from '@/lib/db/search';
import { emailUrl } from '@/lib/urls';
import { Link } from '@/i18n/navigation';
import { Container } from './container';
import { Navigation } from './navigation';
import { MobileMenu } from './mobile-menu';
import { ThemeSwitch } from './theme-switch';
import { BrandMark } from './brand-mark';
import { CommandPalette } from './command-palette';
export async function Header() {
  const [t, items, profile] = await Promise.all([getTranslations('Site'), listSearchItems(), getProfile()]);
  return <header className="site-header"><Container className="header-inner">
    <Link href="/" className="brand"><BrandMark />{t('brand')}</Link>
    <div className="flex items-center gap-2">
      <Suspense><nav className="hidden items-center gap-2 md:flex" aria-label={t('navigation')}><Navigation /></nav></Suspense>
      <CommandPalette items={items} email={emailUrl(profile.email) ? profile.email : null} />
      <ThemeSwitch /><Suspense><MobileMenu /></Suspense>
    </div>
  </Container></header>;
}
