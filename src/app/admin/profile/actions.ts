'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { isUnauthorizedError, requireAdmin } from '@/lib/auth/admin';
import { adminDb } from '@/lib/db/admin';
import { cleanText, isValidEmail, tooLong } from './validation';

export type ProfileEditorState = { ok: boolean; message: string };

const limits = {
  name: 120,
  headline: 200,
  now: 300,
  location: 120,
  seo: 320,
  bio: 20000,
} as const;

async function ensureAdmin(): Promise<ProfileEditorState | null> {
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

function revalidateProfile() {
  revalidateTag('profile');
  revalidatePath('/zh');
  revalidatePath('/en');
  revalidatePath('/zh/contact');
  revalidatePath('/en/contact');
  revalidatePath('/admin/profile');
}

export async function saveProfileAction(_: ProfileEditorState, formData: FormData): Promise<ProfileEditorState> {
  const denied = await ensureAdmin();
  if (denied) return denied;

  const field = (name: string) => cleanText(formData.get(name));
  const payload = {
    id: 1,
    name_zh: field('name_zh'),
    name_en: field('name_en'),
    headline_zh: field('headline_zh'),
    headline_en: field('headline_en'),
    now_zh: field('now_zh'),
    now_en: field('now_en'),
    bio_zh: field('bio_zh'),
    bio_en: field('bio_en'),
    location_zh: field('location_zh'),
    location_en: field('location_en'),
    email: field('email'),
    seo_description_zh: field('seo_description_zh'),
    seo_description_en: field('seo_description_en'),
    updated_at: new Date().toISOString(),
  };

  if (!payload.name_zh && !payload.name_en) return { ok: false, message: '請至少填寫一種語言的姓名。' };
  if (payload.email && !isValidEmail(payload.email)) return { ok: false, message: 'Email 格式不正確。' };

  const checks: [string, number, string][] = [
    [payload.name_zh, limits.name, '姓名（中文）'], [payload.name_en, limits.name, '姓名（English）'],
    [payload.headline_zh, limits.headline, '定位句（中文）'], [payload.headline_en, limits.headline, '定位句（English）'],
    [payload.now_zh, limits.now, '目前狀態（中文）'], [payload.now_en, limits.now, '目前狀態（English）'],
    [payload.location_zh, limits.location, '所在地（中文）'], [payload.location_en, limits.location, '所在地（English）'],
    [payload.seo_description_zh, limits.seo, 'SEO 描述（中文）'], [payload.seo_description_en, limits.seo, 'SEO 描述（English）'],
    [payload.bio_zh, limits.bio, '自介（中文）'], [payload.bio_en, limits.bio, '自介（English）'],
  ];
  for (const [value, max, label] of checks) {
    if (tooLong(value, max)) return { ok: false, message: `${label}不能超過 ${max} 個字。` };
  }

  const { db, error } = getDb();
  if (!db) return { ok: false, message: error };

  // The profile table is a single row (id = 1); upsert creates it when the seed row is missing.
  const saved = await db.from('profile').upsert(payload, { onConflict: 'id' }).select('id').maybeSingle();
  if (saved.error) return { ok: false, message: `儲存失敗：${saved.error.message}` };
  if (!saved.data) return { ok: false, message: '儲存失敗：資料庫沒有回傳 profile 資料列。' };

  revalidateProfile();
  return { ok: true, message: '個人資料已更新。' };
}
