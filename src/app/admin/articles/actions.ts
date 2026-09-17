'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { isUnauthorizedError, requireAdmin } from '@/lib/auth/admin';
import { adminDb } from '@/lib/db/admin';
import type { ContentStatus } from '@/types/content';

export type ArticleEditorState = { ok: boolean; message: string };

const statusValues: ContentStatus[] = ['draft', 'scheduled', 'published', 'archived'];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function ensureAdmin(): Promise<ArticleEditorState | null> {
  try {
    await requireAdmin();
    return null;
  } catch (error) {
    if (isUnauthorizedError(error)) return { ok: false, message: 'Please sign in as an admin first.' };
    throw error;
  }
}

function getDb() {
  try {
    return { db: adminDb(), error: '' };
  } catch {
    return { db: null, error: 'Missing Supabase service role credentials.' };
  }
}

function cleanText(value: FormDataEntryValue | null) {
  return String(value || '').trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

function parseTags(value: string) {
  return value
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeDateTime(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function estimateReadingMinutes(...parts: string[]) {
  const text = parts.join(' ').replace(/[#*_`>\-[\]()]/g, ' ');
  const wordLike = text.match(/[A-Za-z0-9]+|[\u4e00-\u9fff]/g) || [];
  return Math.max(1, Math.ceil(wordLike.length / 220));
}

function revalidateArticles(slug?: string) {
  revalidateTag('posts');
  revalidatePath('/zh');
  revalidatePath('/en');
  revalidatePath('/zh/articles');
  revalidatePath('/en/articles');
  if (slug) {
    revalidatePath(`/zh/articles/${slug}`);
    revalidatePath(`/en/articles/${slug}`);
  }
}

export async function saveArticleAction(_: ArticleEditorState, formData: FormData): Promise<ArticleEditorState> {
  const denied = await ensureAdmin();
  if (denied) return denied;

  const id = cleanText(formData.get('id'));
  if (id && !uuidPattern.test(id)) return { ok: false, message: 'Invalid article id.' };

  const titleZh = cleanText(formData.get('title_zh'));
  const titleEn = cleanText(formData.get('title_en'));
  const explicitSlug = slugify(cleanText(formData.get('slug')));
  const slug = explicitSlug || slugify(titleEn || titleZh);
  const statusValue = cleanText(formData.get('status')) as ContentStatus;
  const status = statusValues.includes(statusValue) ? statusValue : 'draft';
  const publishedAt = normalizeDateTime(cleanText(formData.get('published_at')));
  const bodyZh = cleanText(formData.get('body_zh'));
  const bodyEn = cleanText(formData.get('body_en'));
  const readingInput = Number(cleanText(formData.get('reading_minutes')));
  const readingMinutes = Number.isFinite(readingInput) && readingInput > 0
    ? Math.round(readingInput)
    : estimateReadingMinutes(bodyZh, bodyEn);

  if (!titleZh && !titleEn) return { ok: false, message: 'Please enter at least one title.' };
  if (!slug) return { ok: false, message: 'Please enter an English slug, for example: database-index-notes.' };
  if (!bodyZh && !bodyEn) return { ok: false, message: 'Please enter article content.' };
  if (status === 'scheduled' && !publishedAt) return { ok: false, message: 'Scheduled articles need a publish date.' };

  const now = new Date().toISOString();
  const payload = {
    slug,
    title_zh: titleZh || titleEn,
    title_en: titleEn || titleZh,
    excerpt_zh: cleanText(formData.get('excerpt_zh')),
    excerpt_en: cleanText(formData.get('excerpt_en')),
    body_zh: bodyZh,
    body_en: bodyEn,
    cover_url: cleanText(formData.get('cover_url')) || null,
    cover_alt_zh: cleanText(formData.get('cover_alt_zh')),
    cover_alt_en: cleanText(formData.get('cover_alt_en')),
    tags: parseTags(cleanText(formData.get('tags'))),
    reading_minutes: readingMinutes,
    status,
    published_at: status === 'published' ? (publishedAt || now) : publishedAt,
    updated_at: now,
  };

  const { db, error } = getDb();
  if (!db) return { ok: false, message: error };

  let taken = db.from('posts').select('id').eq('slug', slug).limit(1);
  if (id) taken = taken.neq('id', id);
  const existing = await taken.maybeSingle();
  if (existing.error) return { ok: false, message: `Unable to check slug: ${existing.error.message}` };
  if (existing.data) return { ok: false, message: 'This slug is already used by another article.' };

  if (id) {
    const updated = await db.from('posts').update(payload).eq('id', id).select('id').maybeSingle();
    if (updated.error) return { ok: false, message: `Update failed: ${updated.error.message}` };
    if (!updated.data) return { ok: false, message: 'Article not found.' };
  } else {
    const inserted = await db.from('posts').insert(payload);
    if (inserted.error) return { ok: false, message: `Create failed: ${inserted.error.message}` };
  }

  revalidateArticles(slug);
  return { ok: true, message: id ? 'Article updated.' : 'Article created.' };
}

export async function deleteArticleAction(_: ArticleEditorState, formData: FormData): Promise<ArticleEditorState> {
  const denied = await ensureAdmin();
  if (denied) return denied;

  const id = cleanText(formData.get('id'));
  const slug = cleanText(formData.get('slug'));
  const confirmed = formData.get('confirm') === 'on';
  if (!id) return { ok: false, message: 'Missing article id.' };
  if (!uuidPattern.test(id)) return { ok: false, message: 'Invalid article id.' };
  if (!confirmed) return { ok: false, message: 'Please confirm deletion first.' };

  const { db, error } = getDb();
  if (!db) return { ok: false, message: error };

  const deleted = await db.from('posts').delete().eq('id', id).select('id').maybeSingle();
  if (deleted.error) return { ok: false, message: `Delete failed: ${deleted.error.message}` };
  if (!deleted.data) return { ok: false, message: 'Article not found.' };

  revalidateArticles(slug);
  return { ok: true, message: 'Article deleted.' };
}
