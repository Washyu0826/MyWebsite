'use client';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = useTranslations('Site');
  useEffect(() => setMounted(true), []);
  const current = mounted ? theme : 'system';
  const Icon = current === 'dark' ? Moon : current === 'light' ? Sun : Monitor;
  return <div className="relative flex min-h-11 min-w-11 items-center justify-center">
    <Icon size={18} aria-hidden="true" />
    <select aria-label={t('theme')} value={current} onChange={e => setTheme(e.target.value)}
      className="absolute inset-0 h-full w-full cursor-pointer opacity-0 focus-visible:opacity-100 focus-visible:bg-paper">
      <option value="system">{t('system')}</option><option value="light">{t('light')}</option><option value="dark">{t('dark')}</option>
    </select>
  </div>;
}
