'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { adminDb } from '@/lib/db/admin';
import type { ContentStatus } from '@/types/content';

export type ArticleEditorState = { ok: boolean; message: string };

const statusValues: ContentStatus[] = ['draft', 'scheduled', 'published', 'archived'];

function validateToken(formData: FormData) {
  const token = String(formData.get('token') || '');
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return 'Admin password is incorrect, or ADMIN_TOKEN is not set.';
  }
  return '';
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
  const tokenError = validateToken(formData);
  if (tokenError) return { ok: false, message: tokenError };

  const id = cleanText(formData.get('id'));
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

  const db = adminDb();
  const result = id
    ? await db.from('posts').update(payload).eq('id', id)
    : await db.from('posts').insert(payload);

  if (result.error) return { ok: false, message: `Save failed: ${result.error.message}` };

  revalidateArticles(slug);
  return { ok: true, message: id ? 'Article updated.' : 'Article created.' };
}

export async function deleteArticleAction(_: ArticleEditorState, formData: FormData): Promise<ArticleEditorState> {
  const tokenError = validateToken(formData);
  if (tokenError) return { ok: false, message: tokenError };

  const id = cleanText(formData.get('id'));
  const slug = cleanText(formData.get('slug'));
  if (!id) return { ok: false, message: 'Missing article id.' };

  const { error } = await adminDb().from('posts').delete().eq('id', id);
  if (error) return { ok: false, message: `Delete failed: ${error.message}` };

  revalidateArticles(slug);
  return { ok: true, message: 'Article deleted.' };
}
