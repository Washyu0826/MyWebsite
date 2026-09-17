'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { isUnauthorizedError, requireAdmin } from '@/lib/auth/admin';
import { adminDb } from '@/lib/db/admin';
import { buildUploadFileName, storagePathFromPublicUrl, validateUpload } from '@/lib/uploads';

export type ResumeUploadState = { ok: boolean; message: string };

const bucketName = 'resume';

export async function uploadResumeAction(_: ResumeUploadState, formData: FormData): Promise<ResumeUploadState> {
  try {
    await requireAdmin();
  } catch (error) {
    if (isUnauthorizedError(error)) return { ok: false, message: '請先登入管理員帳號。' };
    throw error;
  }

  const locale = formData.get('locale');
  if (locale !== 'zh' && locale !== 'en') {
    return { ok: false, message: '請選擇中文或英文履歷。' };
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: '請選擇一份 PDF 履歷。' };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = validateUpload(file, bucketName, bytes);
  if (!checked.ok) return { ok: false, message: checked.error === '檔案不能超過 8 MB。' ? 'PDF 不能超過 8 MB。' : '目前只接受 PDF 檔案（會檢查檔案內容）。' };

  let db: ReturnType<typeof adminDb>;
  try {
    db = adminDb();
  } catch {
    return { ok: false, message: '尚未設定 Supabase 上傳憑證（SUPABASE_SERVICE_ROLE_KEY）。' };
  }

  const column = locale === 'en' ? 'resume_en_url' : 'resume_zh_url';
  const previous = await db.from('profile').select(column).eq('id', 1).maybeSingle();
  const previousUrl = previous.data ? (previous.data as Record<string, string | null>)[column] : null;
  const previousPath = storagePathFromPublicUrl(previousUrl, bucketName);

  const storagePath = `${locale}/${buildUploadFileName(file.name, checked.mime)}`;
  const upload = await db.storage.from(bucketName).upload(storagePath, file, {
    cacheControl: '3600',
    contentType: checked.mime,
    upsert: false,
  });
  if (upload.error) return { ok: false, message: `上傳失敗：${upload.error.message}` };

  const { data } = db.storage.from(bucketName).getPublicUrl(storagePath);
  const update = locale === 'en'
    ? { resume_en_url: data.publicUrl, resume_updated_at: new Date().toISOString() }
    : { resume_zh_url: data.publicUrl, resume_updated_at: new Date().toISOString() };
  const saved = await db.from('profile').update(update).eq('id', 1);
  if (saved.error) return { ok: false, message: `資料庫更新失敗：${saved.error.message}` };

  let note = '';
  if (previousPath && previousPath !== storagePath) {
    const removed = await db.storage.from(bucketName).remove([previousPath]);
    note = removed.error ? `（舊檔 ${previousPath} 未能刪除，可到檔案管理手動清理。）` : '（舊檔已刪除。）';
  }

  revalidateTag('profile');
  revalidatePath('/zh');
  revalidatePath('/en');
  revalidatePath('/zh/contact');
  revalidatePath('/en/contact');
  return { ok: true, message: `${locale === 'zh' ? '中文' : '英文'}履歷已更新。${note}` };
}
