'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { isUnauthorizedError, requireAdmin } from '@/lib/auth/admin';
import { adminDb } from '@/lib/db/admin';
import {
  cleanText, isExperienceKind, isValidHttpUrl, normalizeDate, parseSortOrder, tooLong, uuidPattern,
} from '../profile/validation';

export type ExperienceEditorState = { ok: boolean; message: string; id?: string };

const limits = { org: 160, role: 160, description: 10000 } as const;

async function ensureAdmin(): Promise<ExperienceEditorState | null> {
  try {
    await requireAdmin();
    return null;
  } catch (error) {
    if (isUnauthorizedError(error)) return { ok: false, message: '請先登入管理員帳號。' };
    throw error;
  }
}

function getDb() {
  try {
    return { db: adminDb(), error: '' };
  } catch {
    return { db: null, error: '尚未設定 Supabase service role 憑證（SUPABASE_SERVICE_ROLE_KEY）。' };
  }
}

function revalidateExperiences() {
  revalidateTag('experience');
  revalidatePath('/zh');
  revalidatePath('/en');
  revalidatePath('/admin/experiences');
}

export async function saveExperienceAction(_: ExperienceEditorState, formData: FormData): Promise<ExperienceEditorState> {
  const denied = await ensureAdmin();
  if (denied) return denied;

  const id = cleanText(formData.get('id'));
  if (id && !uuidPattern.test(id)) return { ok: false, message: '無效的經歷 id。' };

  const kind = cleanText(formData.get('kind'));
  if (!isExperienceKind(kind)) return { ok: false, message: '請選擇經歷類型。' };

  const orgZh = cleanText(formData.get('org_zh'));
  const orgEn = cleanText(formData.get('org_en'));
  const roleZh = cleanText(formData.get('role_zh'));
  const roleEn = cleanText(formData.get('role_en'));
  const descriptionZh = cleanText(formData.get('description_zh'));
  const descriptionEn = cleanText(formData.get('description_en'));
  const isCurrent = formData.get('is_current') === 'on';
  const isVisible = formData.get('is_visible') === 'on';
  const url = cleanText(formData.get('url'));

  if (!orgZh && !orgEn) return { ok: false, message: '請至少填寫一種語言的單位名稱。' };
  const checks: [string, number, string][] = [
    [orgZh, limits.org, '單位（中文）'], [orgEn, limits.org, '單位（English）'],
    [roleZh, limits.role, '職稱／身分（中文）'], [roleEn, limits.role, '職稱／身分（English）'],
    [descriptionZh, limits.description, '說明（中文）'], [descriptionEn, limits.description, '說明（English）'],
  ];
  for (const [value, max, label] of checks) {
    if (tooLong(value, max)) return { ok: false, message: `${label}不能超過 ${max} 個字。` };
  }

  const startDate = normalizeDate(cleanText(formData.get('start_date')));
  if (!startDate) return { ok: false, message: '請填寫有效的開始日期。' };

  let endDate: string | null = null;
  if (!isCurrent) {
    const endInput = cleanText(formData.get('end_date'));
    if (endInput) {
      endDate = normalizeDate(endInput);
      if (!endDate) return { ok: false, message: '結束日期格式不正確。' };
      if (endDate < startDate) return { ok: false, message: '結束日期不能早於開始日期。' };
    }
  }

  if (url && !isValidHttpUrl(url)) return { ok: false, message: '連結必須是 http(s) 開頭的完整網址。' };

  const payload = {
    kind,
    org_zh: orgZh || orgEn,
    org_en: orgEn,
    role_zh: roleZh,
    role_en: roleEn,
    description_zh: descriptionZh,
    description_en: descriptionEn,
    start_date: startDate,
    end_date: endDate,
    is_current: isCurrent,
    url: url || null,
    sort_order: parseSortOrder(cleanText(formData.get('sort_order'))),
    is_visible: isVisible,
    updated_at: new Date().toISOString(),
  };

  const { db, error } = getDb();
  if (!db) return { ok: false, message: error };

  if (id) {
    const updated = await db.from('experiences').update(payload).eq('id', id).select('id').maybeSingle();
    if (updated.error) return { ok: false, message: `更新失敗：${updated.error.message}` };
    if (!updated.data) return { ok: false, message: '找不到這筆經歷。' };
    revalidateExperiences();
    return { ok: true, message: '經歷已更新。', id };
  }

  const inserted = await db.from('experiences').insert(payload).select('id').maybeSingle();
  if (inserted.error) return { ok: false, message: `建立失敗：${inserted.error.message}` };
  revalidateExperiences();
  return { ok: true, message: '經歷已建立。', id: inserted.data?.id };
}

export async function deleteExperienceAction(_: ExperienceEditorState, formData: FormData): Promise<ExperienceEditorState> {
  const denied = await ensureAdmin();
  if (denied) return denied;

  const id = cleanText(formData.get('id'));
  const confirmed = formData.get('confirm') === 'on';
  if (!id) return { ok: false, message: '缺少經歷 id。' };
  if (!uuidPattern.test(id)) return { ok: false, message: '無效的經歷 id。' };
  if (!confirmed) return { ok: false, message: '請先勾選確認刪除。' };

  const { db, error } = getDb();
  if (!db) return { ok: false, message: error };

  const deleted = await db.from('experiences').delete().eq('id', id).select('id').maybeSingle();
  if (deleted.error) return { ok: false, message: `刪除失敗：${deleted.error.message}` };
  if (!deleted.data) return { ok: false, message: '找不到這筆經歷。' };

  revalidateExperiences();
  return { ok: true, message: '經歷已刪除。' };
}
