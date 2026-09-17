'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link, usePathname } from '@/i18n/navigation';
export function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('Site');
  const pathname = usePathname();
  const locale = useLocale();
  const search = useSearchParams();
  const links = [
    { href: '/', label: 'about' },
    { href: '/projects', label: 'projects' },
    { href: '/articles', label: 'articles' },
    { href: '/contact', label: 'contact' },
  ] as const;
  return <>
    {links.map(({ href, label }) => <Link key={href} href={href} onClick={onNavigate}
      className="nav-link" aria-current={(href === '/' ? pathname === '/' : pathname.startsWith(href)) ? 'page' : undefined}>
      {t(label)}
    </Link>)}
    <Link href={`${pathname}${search.size ? `?${search.toString()}` : ''}`} locale={locale === 'zh' ? 'en' : 'zh'}
      onClick={onNavigate} className="nav-link" aria-label={t('language')} lang={locale === 'zh' ? 'en' : 'zh'}>
      {t('languageShort')}
    </Link>
  </>;
}
