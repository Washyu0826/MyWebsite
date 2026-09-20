'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { isUnauthorizedError, requireAdmin } from '@/lib/auth/admin';
import { adminDb } from '@/lib/db/admin';
import { diffAgainstCurrent, revisionSnapshot, saveRevision, snapshotToColumn } from '@/lib/revisions';
import type { FieldDiff } from '@/lib/diff';
import { revisionFields } from '@/lib/diff';
import type { ContentStatus, Post } from '@/types/content';

export type ArticleEditorState = { ok: boolean; message: string };
export type RevisionDiffState = { ok: boolean; message: string; fields?: FieldDiff[]; createdAt?: string };

const statusValues: ContentStatus[] = ['draft', 'scheduled', 'published', 'archived'];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Either the refusal to return to the browser, or the id of the signed-in admin. */
type Authorized = { denied: ArticleEditorState } | { actor: string };

async function ensureAdmin(): Promise<Authorized> {
  try {
    return { actor: (await requireAdmin()).id };
  } catch (error) {
    if (isUnauthorizedError(error)) return { denied: { ok: false, message: 'Please sign in as an admin first.' } };
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
  const auth = await ensureAdmin();
  if ('denied' in auth) return auth.denied;

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
    // The content as it stands is the thing worth keeping; read it before the update overwrites it.
    const before = await db.from('posts').select('*').eq('id', id).maybeSingle();
    const updated = await db.from('posts').update(payload).eq('id', id).select('*').maybeSingle();
    if (updated.error) return { ok: false, message: `Update failed: ${updated.error.message}` };
    if (!updated.data) return { ok: false, message: 'Article not found.' };
    // An article that predates the revision table has no history, so the pre-edit state is stored
    // first; post_save_revision() drops it when it is identical to what is already the latest.
    if (before.data) await saveRevision(auth.actor, id, revisionSnapshot(before.data as Post));
    await saveRevision(auth.actor, id, revisionSnapshot(updated.data as Post));
  } else {
    const inserted = await db.from('posts').insert(payload).select('*').maybeSingle();
    if (inserted.error) return { ok: false, message: `Create failed: ${inserted.error.message}` };
    if (inserted.data) await saveRevision(auth.actor, (inserted.data as Post).id, revisionSnapshot(inserted.data as Post));
  }

  revalidateArticles(slug);
  return { ok: true, message: id ? 'Article updated.' : 'Article created.' };
}

export async function deleteArticleAction(_: ArticleEditorState, formData: FormData): Promise<ArticleEditorState> {
  const auth = await ensureAdmin();
  if ('denied' in auth) return auth.denied;

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

/** The diff a reader needs before restoring: this revision against the article as it stands now. */
export async function diffRevisionAction(_: RevisionDiffState, formData: FormData): Promise<RevisionDiffState> {
  const auth = await ensureAdmin();
  if ('denied' in auth) return auth.denied;

  const id = cleanText(formData.get('id'));
  const revision = Number(cleanText(formData.get('revision')));
  if (!uuidPattern.test(id) || !Number.isInteger(revision) || revision < 1) return { ok: false, message: '無效的修訂編號。' };

  const { db, error } = getDb();
  if (!db) return { ok: false, message: error };

  try {
    const result = await diffAgainstCurrent(id, revision);
    if (!result) return { ok: false, message: '找不到這個修訂版本。' };
    return result.fields.length
      ? { ok: true, message: '', fields: result.fields, createdAt: result.createdAt }
      : { ok: true, message: '這個版本與目前內容相同。', fields: [], createdAt: result.createdAt };
  } catch {
    return { ok: false, message: '無法讀取修訂版本，請確認已套用 20260920000500_post_revisions.sql。' };
  }
}

/**
 * Writes a stored revision back over the article and forces it to draft, so nothing reaches the
 * public site until it has been read through and published again. The restore is itself recorded,
 * which means restoring the wrong revision can be undone the same way.
 */
export async function restoreRevisionAction(_: ArticleEditorState, formData: FormData): Promise<ArticleEditorState> {
  const auth = await ensureAdmin();
  if ('denied' in auth) return auth.denied;

  const id = cleanText(formData.get('id'));
  const revision = Number(cleanText(formData.get('revision')));
  if (!uuidPattern.test(id) || !Number.isInteger(revision) || revision < 1) return { ok: false, message: '無效的修訂編號。' };

  const { db, error } = getDb();
  if (!db) return { ok: false, message: error };

  const { getRevision } = await import('@/lib/revisions');
  const stored = await getRevision(id, revision);
  if (!stored) return { ok: false, message: '找不到這個修訂版本，或修訂資料表尚未建立。' };

  const current = await db.from('posts').select('*').eq('id', id).maybeSingle();
  if (current.error) return { ok: false, message: `無法讀取文章：${current.error.message}` };
  if (!current.data) return { ok: false, message: '找不到這篇文章。' };
  const post = current.data as Post;

  const payload: Record<string, unknown> = {};
  for (const { field } of revisionFields) payload[field] = snapshotToColumn(field, stored.snapshot[field]);

  // A slug the old version used may belong to another article by now; keeping the live one is the
  // safe choice, and the message says which slug is in effect.
  let slugNote = '';
  const restoredSlug = String(payload.slug || '');
  if (restoredSlug && restoredSlug !== post.slug) {
    const taken = await db.from('posts').select('id').eq('slug', restoredSlug).neq('id', id).limit(1).maybeSingle();
    if (taken.error) return { ok: false, message: `無法檢查網址代稱：${taken.error.message}` };
    if (taken.data) {
      payload.slug = post.slug;
      slugNote = `舊網址代稱 ${restoredSlug} 已被其他文章使用，維持 ${post.slug}。`;
    } else {
      slugNote = `網址代稱回復為 ${restoredSlug}。`;
    }
  }
  // Restoring never republishes by itself.
  payload.status = 'draft';
  payload.updated_at = new Date().toISOString();

  // The state being replaced is kept first, so the restore itself can be undone.
  await saveRevision(auth.actor, id, revisionSnapshot(post));
  // Every value came through snapshotToColumn(), which coerces each field to its column type.
  const updated = await db.from('posts').update(payload as Partial<Post>).eq('id', id).select('*').maybeSingle();
  if (updated.error) return { ok: false, message: `還原失敗：${updated.error.message}` };
  if (!updated.data) return { ok: false, message: '找不到這篇文章。' };
  await saveRevision(auth.actor, id, revisionSnapshot(updated.data as Post), 'restore');

  revalidateArticles(post.slug);
  if (payload.slug !== post.slug) revalidateArticles(String(payload.slug));
  revalidatePath(`/admin/articles/${id}`);
  return { ok: true, message: `已還原第 ${revision} 版，文章已轉為草稿，確認後再發布。${slugNote}` };
}
