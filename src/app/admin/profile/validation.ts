/**
 * Pure validation helpers shared by the profile / experiences / social-links admin actions.
 * No server-only imports here so the helpers can be unit-tested with node:test.
 */

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export const experienceKinds = ['work', 'education', 'award', 'activity'] as const;
export type ExperienceKind = (typeof experienceKinds)[number];

export const experienceKindLabels: Record<ExperienceKind, string> = {
  work: '工作',
  education: '學歷',
  award: '獲獎',
  activity: '活動',
};

export function cleanText(value: FormDataEntryValue | null | undefined) {
  return String(value || '').trim();
}

export function isValidEmail(value: string) {
  return value.length <= 254 && emailPattern.test(value);
}

/** Accepts absolute http(s) URLs only. */
export function isValidHttpUrl(value: string) {
  if (value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Social links may also be mailto: addresses. */
export function isValidSocialUrl(value: string) {
  if (value.toLowerCase().startsWith('mailto:')) return isValidEmail(value.slice('mailto:'.length));
  return isValidHttpUrl(value);
}

export function isExperienceKind(value: string): value is ExperienceKind {
  return (experienceKinds as readonly string[]).includes(value);
}

/** Validates a YYYY-MM-DD calendar date (as produced by <input type="date">). Returns the same string or null. */
export function normalizeDate(value: string): string | null {
  const match = datePattern.exec(value);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return value;
}

/** Parses a sort order; empty or invalid input falls back to 0. Clamped to a sane range. */
export function parseSortOrder(value: string, fallback = 0) {
  if (!value) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(-9999, Math.min(9999, Math.trunc(number)));
}

/** Platform keys are lowercase slugs such as github / linkedin / email / x. */
export function normalizePlatform(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

export function tooLong(value: string, max: number) {
  return value.length > max;
}
