import type { Locale } from '@/i18n/routing';
type Localized<T> = { [K in keyof T as K extends `${infer Base}_zh` ? Base : never]: string };
export function pickLocale<T extends object>(row: T, locale: Locale): Localized<T> {
  const entries = row as Record<string, unknown>;
  return Object.fromEntries(Object.keys(entries).filter(key => key.endsWith('_zh')).map(key => {
    const base = key.slice(0, -3);
    const translated = entries[`${base}_${locale}`];
    return [base, typeof translated === 'string' && translated.trim() ? translated : entries[key] ?? ''];
  })) as Localized<T>;
}
export function dateLabel(value: string | null, locale: Locale) {
  if (!value) return '';
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-TW' : 'en', {
    year: 'numeric', month: 'short', timeZone: 'UTC',
  }).format(new Date(value));
}
