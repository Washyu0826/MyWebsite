'use client';
import { useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link, usePathname } from '@/i18n/navigation';
export function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('Site');
  const pathname = usePathname();
  const locale = useLocale();
  const search = useSearchParams();
  const indicator = useRef<HTMLSpanElement>(null);
  const items = useRef(new Map<string, HTMLAnchorElement>());
  const links = [
    { href: '/', label: 'about' },
    { href: '/projects', label: 'projects' },
    { href: '/articles', label: 'articles' },
    { href: '/contact', label: 'contact' },
  ] as const;
  const current = links.find(({ href }) => (href === '/' ? pathname === '/' : pathname.startsWith(href)))?.href;
  // The rule under the current page slides to its new place. It is measured against the <nav> the
  // component is rendered into, so the desktop header and the mobile menu each get their own, and a
  // nav that is display:none (or a route with no match) simply drops back to the CSS underline.
  useEffect(() => {
    const bar = indicator.current;
    const nav = bar?.parentElement;
    if (!bar || !nav) return;
    let live = true;
    const measure = () => {
      const link = current ? items.current.get(current) : undefined;
      const navBox = nav.getBoundingClientRect();
      const box = link?.getBoundingClientRect();
      if (!link || !box?.width || !navBox.width) { delete bar.dataset.ready; return; }
      const pad = parseFloat(getComputedStyle(link).paddingLeft) || 0;
      const size = parseFloat(getComputedStyle(link).fontSize) || 14;
      bar.style.width = `${Math.max(box.width - pad * 2, 0)}px`;
      bar.style.transform = `translate(${box.left - navBox.left + pad}px, ${box.top + box.height / 2 + size * 0.85 - navBox.top}px)`;
      bar.dataset.ready = '1';
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    window.addEventListener('resize', measure);
    // Web fonts land after the first measurement and change every label's width.
    document.fonts?.ready.then(() => { if (live) measure(); });
    return () => { live = false; observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [current]);
  return <>
    {links.map(({ href, label }) => <Link key={href} href={href} onClick={onNavigate}
      ref={node => { if (node) items.current.set(href, node); else items.current.delete(href); }}
      className="nav-link" aria-current={href === current ? 'page' : undefined}>
      {t(label)}
    </Link>)}
    <Link href={`${pathname}${search.size ? `?${search.toString()}` : ''}`} locale={locale === 'zh' ? 'en' : 'zh'}
      onClick={onNavigate} className="nav-link" aria-label={t('language')} lang={locale === 'zh' ? 'en' : 'zh'}>
      {t('languageShort')}
    </Link>
    <span ref={indicator} className="nav-indicator" aria-hidden="true" />
  </>;
}
