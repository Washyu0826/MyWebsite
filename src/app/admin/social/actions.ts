'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { isUnauthorizedError, requireAdmin } from '@/lib/auth/admin';
import { adminDb } from '@/lib/db/admin';
import {
  cleanText, isValidSocialUrl, normalizePlatform, parseSortOrder, tooLong, uuidPattern,
} from '../profile/validation';

export type SocialLinkState = { ok: boolean; message: string };

const labelLimit = 80;

async function ensureAdmin(): Promise<SocialLinkState | null> {
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

// Social links are loaded through getProfile(), which is cached under the 'profile' tag.
function revalidateSocialLinks() {
  revalidateTag('profile');
  revalidatePath('/zh');
  revalidatePath('/en');
  revalidatePath('/zh/contact');
  revalidatePath('/en/contact');
  revalidatePath('/admin/social');
}

function parseSocialLink(formData: FormData) {
  const platform = normalizePlatform(cleanText(formData.get('platform')));
  const label = cleanText(formData.get('label'));
  const url = cleanText(formData.get('url'));

  if (!platform) return { error: '請填寫平台代號（例如 github、linkedin、email、x）。' };
  if (tooLong(label, labelLimit)) return { error: `顯示名稱不能超過 ${labelLimit} 個字。` };
  if (!url) return { error: '請填寫連結網址。' };
  if (!isValidSocialUrl(url)) return { error: '連結必須是 http(s) 網址或 mailto: 電子郵件。' };

  return {
    error: '',
    payload: {
      platform,
      label,
      url,
      sort_order: parseSortOrder(cleanText(formData.get('sort_order'))),
      is_visible: formData.get('is_visible') === 'on',
    },
  };
}

export async function createSocialLinkAction(_: SocialLinkState, formData: FormData): Promise<SocialLinkState> {
  const denied = await ensureAdmin();
  if (denied) return denied;

  const parsed = parseSocialLink(formData);
  if (!parsed.payload) return { ok: false, message: parsed.error };

  const { db, error } = getDb();
  if (!db) return { ok: false, message: error };

  const inserted = await db.from('social_links').insert(parsed.payload).select('id').maybeSingle();
  if (inserted.error) return { ok: false, message: `建立失敗：${inserted.error.message}` };

  revalidateSocialLinks();
  return { ok: true, message: '社群連結已建立。' };
}

export async function updateSocialLinkAction(_: SocialLinkState, formData: FormData): Promise<SocialLinkState> {
  const denied = await ensureAdmin();
  if (denied) return denied;

  const id = cleanText(formData.get('id'));
  if (!id || !uuidPattern.test(id)) return { ok: false, message: '無效的連結 id。' };

  const parsed = parseSocialLink(formData);
  if (!parsed.payload) return { ok: false, message: parsed.error };

  const { db, error } = getDb();
  if (!db) return { ok: false, message: error };

  const updated = await db.from('social_links').update(parsed.payload).eq('id', id).select('id').maybeSingle();
  if (updated.error) return { ok: false, message: `更新失敗：${updated.error.message}` };
  if (!updated.data) return { ok: false, message: '找不到這筆連結。' };

  revalidateSocialLinks();
  return { ok: true, message: '社群連結已更新。' };
}

export async function deleteSocialLinkAction(_: SocialLinkState, formData: FormData): Promise<SocialLinkState> {
  const denied = await ensureAdmin();
  if (denied) return denied;

  const id = cleanText(formData.get('id'));
  const confirmed = formData.get('confirm') === 'on';
  if (!id || !uuidPattern.test(id)) return { ok: false, message: '無效的連結 id。' };
  if (!confirmed) return { ok: false, message: '請先勾選確認刪除。' };

  const { db, error } = getDb();
  if (!db) return { ok: false, message: error };

  const deleted = await db.from('social_links').delete().eq('id', id).select('id').maybeSingle();
  if (deleted.error) return { ok: false, message: `刪除失敗：${deleted.error.message}` };
  if (!deleted.data) return { ok: false, message: '找不到這筆連結。' };

  revalidateSocialLinks();
  return { ok: true, message: '社群連結已刪除。' };
}
