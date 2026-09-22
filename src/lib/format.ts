import type { Locale } from '@/i18n/routing';

// Dates in the database are plain days (or UTC timestamps); formatting them in the viewer's zone
// would move a 2026-09-01 launch to August for anyone west of UTC.
const ZONE = 'UTC';
export function intlLocale(locale: Locale) { return locale === 'zh' ? 'zh-TW' : 'en-US'; }

function toDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
// Intl renders Traditional Chinese dates as "2026年9月"; house style spaces the Latin digits
// away from the CJK units, so "2026 年 9 月".
function space(value: string, locale: Locale) {
  return locale === 'zh' ? value.replace(/(\d)([年月日])/g, '$1 $2').replace(/([年月日])(\d)/g, '$1 $2') : value;
}
function format(value: string | Date | null | undefined, locale: Locale, options: Intl.DateTimeFormatOptions) {
  const date = toDate(value);
  if (!date) return '';
  return space(new Intl.DateTimeFormat(intlLocale(locale), { timeZone: ZONE, ...options }).format(date), locale);
}

/** "2026 年 9 月" / "Sep 2026" — experience ranges and project periods. */
export function monthLabel(value: string | Date | null | undefined, locale: Locale) {
  return format(value, locale, { year: 'numeric', month: locale === 'zh' ? 'long' : 'short' });
}
/** "2026 年 9 月 20 日" / "Sep 20, 2026" — published dates in lists. */
export function dayLabel(value: string | Date | null | undefined, locale: Locale) {
  return format(value, locale, { year: 'numeric', month: locale === 'zh' ? 'long' : 'short', day: 'numeric' });
}
/** "2026 年 9 月 20 日" / "September 20, 2026" — the dateline on an article or project page. */
export function longDayLabel(value: string | Date | null | undefined, locale: Locale) {
  return format(value, locale, { year: 'numeric', month: 'long', day: 'numeric' });
}
/** Machine-readable value for <time dateTime> and JSON-LD. */
export function isoDate(value: string | Date | null | undefined) {
  return toDate(value)?.toISOString() ?? '';
}

/** "2025 年 3 月 – 2025 年 6 月"; `present` closes an open range ("至今" / "Present"). */
export function monthRangeLabel(start: string | Date | null | undefined, end: string | Date | null | undefined, locale: Locale, present?: string) {
  const from = monthLabel(start, locale);
  if (!from) return '';
  const to = monthLabel(end, locale) || present || '';
  return to ? `${from} – ${to}` : from;
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86400], ['month', 30 * 86400], ['week', 7 * 86400], ['day', 86400], ['hour', 3600], ['minute', 60],
];
/** "3 天前" / "3 days ago"; empty when the date is unusable. */
export function relativeLabel(value: string | Date | null | undefined, locale: Locale, now: number = Date.now()) {
  const date = toDate(value);
  if (!date) return '';
  const seconds = (date.getTime() - now) / 1000;
  const relative = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto' });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.trunc(seconds / size), unit);
  }
  return relative.format(0, 'day');
}
const RECENT_DAYS = 30;
/** Recent posts read better as "3 天前"; older ones want the actual date. */
export function publishedLabel(value: string | Date | null | undefined, locale: Locale, now: number = Date.now()) {
  const date = toDate(value);
  if (!date) return '';
  const elapsed = now - date.getTime();
  return elapsed >= 0 && elapsed < RECENT_DAYS * 86400_000 ? relativeLabel(date, locale, now) : dayLabel(date, locale);
}

export function numberLabel(value: number, locale: Locale, options?: Intl.NumberFormatOptions) {
  return Number.isFinite(value) ? new Intl.NumberFormat(intlLocale(locale), options).format(value) : '';
}

/**
 * Splits a name written as "Kuan-Yu Hsien (Zenobia)" into the name a document should carry and the
 * one people actually use. Accepts the full-width brackets a Chinese keyboard produces as well as
 * the ASCII pair, and returns the whole string as the name when there is no parenthetical.
 */
export function splitName(value: string | null | undefined): { name: string; nickname: string } {
  const trimmed = (value ?? '').trim();
  const match = trimmed.match(/^(.*?)\s*[(\uff08]([^()\uff08\uff09]+)[)\uff09]$/);
  return match ? { name: match[1].trim(), nickname: match[2].trim() } : { name: trimmed, nickname: '' };
}
