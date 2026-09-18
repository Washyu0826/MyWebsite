// Pure helpers for the projects admin (no Next/Supabase imports) so they can be unit tested with tsx --test.
import type { ContentStatus } from '@/types/content';

export const projectTags = ['web', 'data-ai', 'tool'] as const;
export type ProjectTag = (typeof projectTags)[number];

export const projectTagLabels: Record<ProjectTag, string> = {
  web: 'Web',
  'data-ai': 'Data / AI',
  tool: 'Tool',
};

export const statusValues: ContentStatus[] = ['draft', 'scheduled', 'published', 'archived'];

export const statusLabels: Record<ContentStatus, string> = {
  draft: '草稿',
  scheduled: '排程',
  published: '已發布',
  archived: '封存',
};

export const mediaTypes = ['image', 'video'] as const;
export type MediaType = (typeof mediaTypes)[number];

/** Bilingual text fields (suffix _zh / _en) that AI translation handles. */
export const projectTextKeys = [
  'title', 'summary', 'problem', 'solution', 'outcome', 'contribution', 'body', 'cover_alt', 'architecture_alt', 'role',
] as const;
export type ProjectTextKey = (typeof projectTextKeys)[number];
export type ProjectTextFields = Record<ProjectTextKey, string>;

export const projectFieldLabels: Record<ProjectTextKey, string> = {
  title: '標題', summary: '摘要', problem: '問題', solution: '解法', outcome: '成果', contribution: '個人貢獻',
  body: '實作細節', cover_alt: '封面替代文字', architecture_alt: '架構圖替代文字', role: '角色',
};

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

/** Comma / newline separated list -> trimmed, de-duplicated items (max `limit`, each max 60 chars). */
export function parseList(value: string, limit = 30) {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const raw of value.split(/[,\n]/)) {
    const item = raw.trim().slice(0, 60);
    if (!item || seen.has(item.toLowerCase())) continue;
    seen.add(item.toLowerCase());
    items.push(item);
    if (items.length >= limit) break;
  }
  return items;
}

export function parseTags(values: unknown[]): ProjectTag[] {
  const picked = new Set<ProjectTag>();
  for (const value of values) {
    if (typeof value === 'string' && (projectTags as readonly string[]).includes(value)) picked.add(value as ProjectTag);
  }
  return projectTags.filter(tag => picked.has(tag));
}

export type UrlCheck = { ok: true; value: string | null } | { ok: false; value: null };

/** Empty -> null; absolute http(s) URL or site-relative path (`/...`) -> normalised; anything else -> invalid. */
export function parseUrl(value: string): UrlCheck {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return { ok: true, value: trimmed };
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, value: null };
    return { ok: true, value: url.href };
  } catch {
    return { ok: false, value: null };
  }
}

export type DateCheck = { ok: true; value: string | null } | { ok: false; value: null };

/** `YYYY-MM-DD` (from <input type="date">) -> the same string when it is a real calendar date; empty -> null. */
export function parseDateInput(value: string): DateCheck {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return { ok: false, value: null };
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return valid ? { ok: true, value: trimmed } : { ok: false, value: null };
}

export function normalizeDateTime(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export type IntCheck = { ok: true; value: number | null } | { ok: false; value: null };

/** Empty -> null; otherwise an integer within [min, max]. */
export function parseInteger(value: string, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}): IntCheck {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  if (!/^-?\d+$/.test(trimmed)) return { ok: false, value: null };
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) return { ok: false, value: null };
  return { ok: true, value: parsed };
}

export function isPubliclyVisible(project: { status: ContentStatus; published_at: string | null }, now = Date.now()) {
  return project.status === 'published' && !!project.published_at && new Date(project.published_at).getTime() <= now;
}
