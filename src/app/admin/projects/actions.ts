'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { isUnauthorizedError, requireAdmin } from '@/lib/auth/admin';
import { adminDb } from '@/lib/db/admin';
import type { ContentStatus, Project, ProjectMedia, ProjectMetric } from '@/types/content';
import {
  mediaTypes, normalizeDateTime, parseDateInput, parseInteger, parseList, parseTags, parseUrl,
  slugify, statusValues, uuidPattern, type MediaType,
} from './fields';

export type ProjectEditorState = { ok: boolean; message: string };

type Db = ReturnType<typeof adminDb>;

const limits = {
  title: 200, summary: 500, section: 20_000, body: 60_000, alt: 300, role: 100,
  mediaAlt: 300, caption: 500, metricValue: 40, metricLabel: 100,
} as const;

async function ensureAdmin(): Promise<ProjectEditorState | null> {
  try {
    await requireAdmin();
    return null;
  } catch (error) {
    if (isUnauthorizedError(error)) return { ok: false, message: '請先登入管理員帳號。' };
    throw error;
  }
}

function getDb(): { db: Db; error: '' } | { db: null; error: string } {
  try {
    return { db: adminDb(), error: '' };
  } catch {
    return { db: null, error: '尚未設定 Supabase service role 憑證，無法寫入資料。' };
  }
}

function cleanText(value: FormDataEntryValue | null, max?: number) {
  const text = String(value || '').trim();
  return max ? text.slice(0, max) : text;
}

function revalidateProjects(slug?: string, projectId?: string) {
  revalidateTag('projects');
  revalidatePath('/admin/projects');
  if (projectId) revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath('/zh');
  revalidatePath('/en');
  revalidatePath('/zh/projects');
  revalidatePath('/en/projects');
  if (slug) {
    revalidateTag(`project:${slug}`);
    revalidatePath(`/zh/projects/${slug}`);
    revalidatePath(`/en/projects/${slug}`);
  }
}

/** Looks up the project's slug so the detail pages can be revalidated after a media/metric write. */
async function findProjectSlug(db: Db, projectId: string): Promise<{ slug: string } | { error: string }> {
  const { data, error } = await db.from('projects').select('slug').eq('id', projectId).maybeSingle();
  if (error) return { error: `無法讀取專案：${error.message}` };
  if (!data) return { error: '找不到對應的專案。' };
  return { slug: data.slug };
}

// ---------------------------------------------------------------------------
// projects
// ---------------------------------------------------------------------------

type UrlField = 'cover_url' | 'architecture_url' | 'video_url' | 'demo_url' | 'repo_url';
const urlFieldLabels: Record<UrlField, string> = {
  cover_url: '封面圖片',
  architecture_url: '架構圖',
  video_url: '影片',
  demo_url: 'Demo',
  repo_url: '程式碼倉庫',
};

export async function saveProjectAction(_: ProjectEditorState, formData: FormData): Promise<ProjectEditorState> {
  const denied = await ensureAdmin();
  if (denied) return denied;

  const id = cleanText(formData.get('id'));
  if (id && !uuidPattern.test(id)) return { ok: false, message: '專案 id 格式錯誤。' };

  const titleZh = cleanText(formData.get('title_zh'), limits.title);
  const titleEn = cleanText(formData.get('title_en'), limits.title);
  const explicitSlug = slugify(cleanText(formData.get('slug')));
  const slug = explicitSlug || slugify(titleEn || titleZh);
  const statusValue = cleanText(formData.get('status')) as ContentStatus;
  const status = statusValues.includes(statusValue) ? statusValue : 'draft';
  const publishedAt = normalizeDateTime(cleanText(formData.get('published_at')));

  if (!titleZh && !titleEn) return { ok: false, message: '請至少填寫一種語言的標題。' };
  if (!slug) return { ok: false, message: '請填寫英文 slug，例如：document-search。' };
  if (status === 'scheduled' && !publishedAt) return { ok: false, message: '排程發布需要設定發布時間。' };

  const urls = {} as Record<UrlField, string | null>;
  for (const field of Object.keys(urlFieldLabels) as UrlField[]) {
    const checked = parseUrl(cleanText(formData.get(field)));
    if (!checked.ok) return { ok: false, message: `${urlFieldLabels[field]}網址格式錯誤，請使用 http(s):// 開頭的完整網址。` };
    urls[field] = checked.value;
  }

  const teamSize = parseInteger(cleanText(formData.get('team_size')), { min: 1, max: 10_000 });
  if (!teamSize.ok) return { ok: false, message: '團隊人數必須是 1 以上的整數，或留空。' };

  const periodStart = parseDateInput(cleanText(formData.get('period_start')));
  const periodEnd = parseDateInput(cleanText(formData.get('period_end')));
  if (!periodStart.ok) return { ok: false, message: '開始日期格式錯誤。' };
  if (!periodEnd.ok) return { ok: false, message: '結束日期格式錯誤。' };
  if (periodStart.value && periodEnd.value && periodEnd.value < periodStart.value) {
    return { ok: false, message: '結束日期不能早於開始日期。' };
  }

  const sortOrder = parseInteger(cleanText(formData.get('sort_order')), { min: -100_000, max: 100_000 });
  if (!sortOrder.ok) return { ok: false, message: '排序必須是整數。' };

  const now = new Date().toISOString();
  const payload: Partial<Project> = {
    slug,
    title_zh: titleZh || titleEn,
    title_en: titleEn || titleZh,
    summary_zh: cleanText(formData.get('summary_zh'), limits.summary),
    summary_en: cleanText(formData.get('summary_en'), limits.summary),
    problem_zh: cleanText(formData.get('problem_zh'), limits.section),
    problem_en: cleanText(formData.get('problem_en'), limits.section),
    solution_zh: cleanText(formData.get('solution_zh'), limits.section),
    solution_en: cleanText(formData.get('solution_en'), limits.section),
    outcome_zh: cleanText(formData.get('outcome_zh'), limits.section),
    outcome_en: cleanText(formData.get('outcome_en'), limits.section),
    contribution_zh: cleanText(formData.get('contribution_zh'), limits.section),
    contribution_en: cleanText(formData.get('contribution_en'), limits.section),
    body_zh: cleanText(formData.get('body_zh'), limits.body),
    body_en: cleanText(formData.get('body_en'), limits.body),
    cover_url: urls.cover_url,
    cover_alt_zh: cleanText(formData.get('cover_alt_zh'), limits.alt),
    cover_alt_en: cleanText(formData.get('cover_alt_en'), limits.alt),
    architecture_url: urls.architecture_url,
    architecture_alt_zh: cleanText(formData.get('architecture_alt_zh'), limits.alt),
    architecture_alt_en: cleanText(formData.get('architecture_alt_en'), limits.alt),
    video_url: urls.video_url,
    role_zh: cleanText(formData.get('role_zh'), limits.role),
    role_en: cleanText(formData.get('role_en'), limits.role),
    team_size: teamSize.value,
    period_start: periodStart.value,
    period_end: periodEnd.value,
    tech_stack: parseList(cleanText(formData.get('tech_stack'))),
    tags: parseTags(formData.getAll('tags')),
    demo_url: urls.demo_url,
    repo_url: urls.repo_url,
    status,
    published_at: status === 'published' ? (publishedAt || now) : publishedAt,
    is_featured: formData.get('is_featured') === 'on',
    sort_order: sortOrder.value ?? 0,
    updated_at: now,
  };

  const { db, error } = getDb();
  if (!db) return { ok: false, message: error };

  let taken = db.from('projects').select('id, slug').eq('slug', slug).limit(1);
  if (id) taken = taken.neq('id', id);
  const existing = await taken.maybeSingle();
  if (existing.error) return { ok: false, message: `無法檢查 slug：${existing.error.message}` };
  if (existing.data) return { ok: false, message: '這個 slug 已被其他專案使用。' };

  let previousSlug: string | undefined;
  if (id) {
    const before = await db.from('projects').select('slug').eq('id', id).maybeSingle();
    if (before.error) return { ok: false, message: `無法讀取專案：${before.error.message}` };
    if (!before.data) return { ok: false, message: '找不到專案。' };
    previousSlug = before.data.slug;

    const updated = await db.from('projects').update(payload).eq('id', id).select('id').maybeSingle();
    if (updated.error) return { ok: false, message: `更新失敗：${updated.error.message}` };
    if (!updated.data) return { ok: false, message: '找不到專案。' };
  } else {
    const inserted = await db.from('projects').insert(payload);
    if (inserted.error) return { ok: false, message: `建立失敗：${inserted.error.message}` };
  }

  revalidateProjects(slug, id || undefined);
  if (previousSlug && previousSlug !== slug) revalidateProjects(previousSlug);
  return { ok: true, message: id ? '專案已更新。' : '專案已建立。' };
}

export async function deleteProjectAction(_: ProjectEditorState, formData: FormData): Promise<ProjectEditorState> {
  const denied = await ensureAdmin();
  if (denied) return denied;

  const id = cleanText(formData.get('id'));
  const slug = cleanText(formData.get('slug'));
  const confirmed = formData.get('confirm') === 'on';
  if (!id) return { ok: false, message: '缺少專案 id。' };
  if (!uuidPattern.test(id)) return { ok: false, message: '專案 id 格式錯誤。' };
  if (!confirmed) return { ok: false, message: '請先勾選確認刪除。' };

  const { db, error } = getDb();
  if (!db) return { ok: false, message: error };

  const deleted = await db.from('projects').delete().eq('id', id).select('id').maybeSingle();
  if (deleted.error) return { ok: false, message: `刪除失敗：${deleted.error.message}` };
  if (!deleted.data) return { ok: false, message: '找不到專案。' };

  revalidateProjects(slug);
  return { ok: true, message: '專案已刪除。' };
}

// ---------------------------------------------------------------------------
// project_media
// ---------------------------------------------------------------------------

type MediaPayload = Pick<ProjectMedia, 'url' | 'media_type' | 'alt_zh' | 'alt_en' | 'caption_zh' | 'caption_en' | 'sort_order'>;

function readMediaPayload(formData: FormData): { payload: MediaPayload } | { error: string } {
  const url = parseUrl(cleanText(formData.get('url')));
  if (!url.ok || !url.value) return { error: '媒體網址必須是 http(s):// 開頭的完整網址。' };
  const mediaType = cleanText(formData.get('media_type')) as MediaType;
  if (!mediaTypes.includes(mediaType)) return { error: '媒體類型只能是 image 或 video。' };
  const sortOrder = parseInteger(cleanText(formData.get('sort_order')), { min: -100_000, max: 100_000 });
  if (!sortOrder.ok) return { error: '排序必須是整數。' };
  return {
    payload: {
      url: url.value,
      media_type: mediaType,
      alt_zh: cleanText(formData.get('alt_zh'), limits.mediaAlt),
      alt_en: cleanText(formData.get('alt_en'), limits.mediaAlt),
      caption_zh: cleanText(formData.get('caption_zh'), limits.caption),
      caption_en: cleanText(formData.get('caption_en'), limits.caption),
      sort_order: sortOrder.value ?? 0,
    },
  };
}

function readIds(formData: FormData, withRowId: boolean): { projectId: string; rowId: string } | { error: string } {
  const projectId = cleanText(formData.get('project_id'));
  if (!uuidPattern.test(projectId)) return { error: '專案 id 格式錯誤。' };
  const rowId = cleanText(formData.get('id'));
  if (withRowId && !uuidPattern.test(rowId)) return { error: '資料列 id 格式錯誤。' };
  return { projectId, rowId };
}

export async function addMediaAction(_: ProjectEditorState, formData: FormData): Promise<ProjectEditorState> {
  const denied = await ensureAdmin();
  if (denied) return denied;
  const ids = readIds(formData, false);
  if ('error' in ids) return { ok: false, message: ids.error };
  const media = readMediaPayload(formData);
  if ('error' in media) return { ok: false, message: media.error };

  const { db, error } = getDb();
  if (!db) return { ok: false, message: error };
  const project = await findProjectSlug(db, ids.projectId);
  if ('error' in project) return { ok: false, message: project.error };

  const inserted = await db.from('project_media').insert({ ...media.payload, project_id: ids.projectId });
  if (inserted.error) return { ok: false, message: `新增失敗：${inserted.error.message}` };

  revalidateProjects(project.slug, ids.projectId);
  return { ok: true, message: '媒體已新增。' };
}

export async function updateMediaAction(_: ProjectEditorState, formData: FormData): Promise<ProjectEditorState> {
  const denied = await ensureAdmin();
  if (denied) return denied;
  const ids = readIds(formData, true);
  if ('error' in ids) return { ok: false, message: ids.error };
  const media = readMediaPayload(formData);
  if ('error' in media) return { ok: false, message: media.error };

  const { db, error } = getDb();
  if (!db) return { ok: false, message: error };
  const project = await findProjectSlug(db, ids.projectId);
  if ('error' in project) return { ok: false, message: project.error };

  const updated = await db.from('project_media').update(media.payload)
    .eq('id', ids.rowId).eq('project_id', ids.projectId).select('id').maybeSingle();
  if (updated.error) return { ok: false, message: `更新失敗：${updated.error.message}` };
  if (!updated.data) return { ok: false, message: '找不到這筆媒體。' };

  revalidateProjects(project.slug, ids.projectId);
  return { ok: true, message: '媒體已更新。' };
}

export async function deleteMediaAction(_: ProjectEditorState, formData: FormData): Promise<ProjectEditorState> {
  const denied = await ensureAdmin();
  if (denied) return denied;
  const ids = readIds(formData, true);
  if ('error' in ids) return { ok: false, message: ids.error };
  if (formData.get('confirm') !== 'on') return { ok: false, message: '請先勾選確認刪除。' };

  const { db, error } = getDb();
  if (!db) return { ok: false, message: error };
  const project = await findProjectSlug(db, ids.projectId);
  if ('error' in project) return { ok: false, message: project.error };

  const deleted = await db.from('project_media').delete()
    .eq('id', ids.rowId).eq('project_id', ids.projectId).select('id').maybeSingle();
  if (deleted.error) return { ok: false, message: `刪除失敗：${deleted.error.message}` };
  if (!deleted.data) return { ok: false, message: '找不到這筆媒體。' };

  revalidateProjects(project.slug, ids.projectId);
  return { ok: true, message: '媒體已刪除。' };
}

// ---------------------------------------------------------------------------
// project_metrics
// ---------------------------------------------------------------------------

type MetricPayload = Pick<ProjectMetric, 'value' | 'label_zh' | 'label_en' | 'sort_order'>;

function readMetricPayload(formData: FormData): { payload: MetricPayload } | { error: string } {
  const value = cleanText(formData.get('value'), limits.metricValue);
  if (!value) return { error: '請填寫數值，例如 120ms 或 40%。' };
  const labelZh = cleanText(formData.get('label_zh'), limits.metricLabel);
  const labelEn = cleanText(formData.get('label_en'), limits.metricLabel);
  if (!labelZh && !labelEn) return { error: '請至少填寫一種語言的標籤。' };
  const sortOrder = parseInteger(cleanText(formData.get('sort_order')), { min: -100_000, max: 100_000 });
  if (!sortOrder.ok) return { error: '排序必須是整數。' };
  return {
    payload: {
      value,
      label_zh: labelZh || labelEn,
      label_en: labelEn || labelZh,
      sort_order: sortOrder.value ?? 0,
    },
  };
}

export async function addMetricAction(_: ProjectEditorState, formData: FormData): Promise<ProjectEditorState> {
  const denied = await ensureAdmin();
  if (denied) return denied;
  const ids = readIds(formData, false);
  if ('error' in ids) return { ok: false, message: ids.error };
  const metric = readMetricPayload(formData);
  if ('error' in metric) return { ok: false, message: metric.error };

  const { db, error } = getDb();
  if (!db) return { ok: false, message: error };
  const project = await findProjectSlug(db, ids.projectId);
  if ('error' in project) return { ok: false, message: project.error };

  const inserted = await db.from('project_metrics').insert({ ...metric.payload, project_id: ids.projectId });
  if (inserted.error) return { ok: false, message: `新增失敗：${inserted.error.message}` };

  revalidateProjects(project.slug, ids.projectId);
  return { ok: true, message: '量化成果已新增。' };
}

export async function updateMetricAction(_: ProjectEditorState, formData: FormData): Promise<ProjectEditorState> {
  const denied = await ensureAdmin();
  if (denied) return denied;
  const ids = readIds(formData, true);
  if ('error' in ids) return { ok: false, message: ids.error };
  const metric = readMetricPayload(formData);
  if ('error' in metric) return { ok: false, message: metric.error };

  const { db, error } = getDb();
  if (!db) return { ok: false, message: error };
  const project = await findProjectSlug(db, ids.projectId);
  if ('error' in project) return { ok: false, message: project.error };

  const updated = await db.from('project_metrics').update(metric.payload)
    .eq('id', ids.rowId).eq('project_id', ids.projectId).select('id').maybeSingle();
  if (updated.error) return { ok: false, message: `更新失敗：${updated.error.message}` };
  if (!updated.data) return { ok: false, message: '找不到這筆量化成果。' };

  revalidateProjects(project.slug, ids.projectId);
  return { ok: true, message: '量化成果已更新。' };
}

export async function deleteMetricAction(_: ProjectEditorState, formData: FormData): Promise<ProjectEditorState> {
  const denied = await ensureAdmin();
  if (denied) return denied;
  const ids = readIds(formData, true);
  if ('error' in ids) return { ok: false, message: ids.error };
  if (formData.get('confirm') !== 'on') return { ok: false, message: '請先勾選確認刪除。' };

  const { db, error } = getDb();
  if (!db) return { ok: false, message: error };
  const project = await findProjectSlug(db, ids.projectId);
  if ('error' in project) return { ok: false, message: project.error };

  const deleted = await db.from('project_metrics').delete()
    .eq('id', ids.rowId).eq('project_id', ids.projectId).select('id').maybeSingle();
  if (deleted.error) return { ok: false, message: `刪除失敗：${deleted.error.message}` };
  if (!deleted.data) return { ok: false, message: '找不到這筆量化成果。' };

  revalidateProjects(project.slug, ids.projectId);
  return { ok: true, message: '量化成果已刪除。' };
}
