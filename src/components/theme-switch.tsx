'use client';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
type Sweep = Document & { startViewTransition?: (update: () => void) => { finished: Promise<void> } };
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const t = useTranslations('Site');
  useEffect(() => setMounted(true), []);
  // Matches ThemeProvider defaultTheme="dark" so the icon does not jump after hydration.
  const current = mounted ? theme ?? 'dark' : 'dark';
  const Icon = current === 'dark' ? Moon : current === 'light' ? Sun : Monitor;
  const choose = (next: string) => {
    const root = document.documentElement, rect = box.current?.getBoundingClientRect();
    const start = (document as Sweep).startViewTransition?.bind(document);
    // No API, no geometry, or a request for less motion: switch outright. next-themes is doing the
    // work either way, so the only thing lost here is the circle.
    if (!start || !rect || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setTheme(next);
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    root.style.setProperty('--sweep-x', `${x}px`);
    root.style.setProperty('--sweep-y', `${y}px`);
    // Far corner: the circle has to clear the whole viewport before it stops growing.
    root.style.setProperty('--sweep-r', `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`);
    root.dataset.themeSweep = '1';
    const transition = start(() => {
      // The class swap has to land inside the callback, and next-themes applies it from an effect a
      // tick later — too late to be captured. So mirror its own <html> write (attribute="class",
      // enableColorScheme, defaultTheme="dark") here, then hand it the state; its later pass is a
      // no-op. If the provider config in providers.tsx changes, this has to follow it.
      const resolved = next === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : next;
      root.classList.remove('light', 'dark');
      root.classList.add(resolved);
      root.style.colorScheme = resolved;
      setTheme(next);
    });
    transition.finished.finally(() => {
      delete root.dataset.themeSweep;
      for (const name of ['--sweep-x', '--sweep-y', '--sweep-r']) root.style.removeProperty(name);
    });
  };
  return <div ref={box} className="relative flex min-h-11 min-w-11 items-center justify-center">
    <Icon size={18} aria-hidden="true" />
    <select aria-label={t('theme')} value={current} onChange={e => choose(e.target.value)}
      className="absolute inset-0 h-full w-full cursor-pointer opacity-0 focus-visible:opacity-100 focus-visible:bg-paper">
      <option value="system">{t('system')}</option><option value="light">{t('light')}</option><option value="dark">{t('dark')}</option>
    </select>
  </div>;
}
