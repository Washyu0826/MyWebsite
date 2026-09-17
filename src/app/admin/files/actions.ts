'use server';

import { revalidatePath } from 'next/cache';
import { isUnauthorizedError, requireAdmin } from '@/lib/auth/admin';
import { adminDb } from '@/lib/db/admin';
import { buildStoragePath, buildUploadFileName, cleanPathPart, isStorageBucket, validateUpload } from '@/lib/uploads';

export type FileManagerState = { ok: boolean; message: string; publicUrl?: string };

const unauthorizedState: FileManagerState = { ok: false, message: '請先登入管理員帳號。' };
const missingSupabaseMessage = '尚未設定 Supabase 上傳憑證。請先在 .env.local 填入 NEXT_PUBLIC_SUPABASE_URL、NEXT_PUBLIC_SUPABASE_ANON_KEY、SUPABASE_SERVICE_ROLE_KEY，然後重啟 npm run dev。';

function getAdminStorage() {
  try {
    return { db: adminDb(), error: '' };
  } catch (error) {
    return {
      db: null,
      error: error instanceof Error && error.message.includes('Supabase')
        ? missingSupabaseMessage
        : error instanceof Error ? error.message : '無法建立 Supabase admin client。',
    };
  }
}

async function ensureAdmin(): Promise<FileManagerState | null> {
  try {
    await requireAdmin();
    return null;
  } catch (error) {
    if (isUnauthorizedError(error)) return unauthorizedState;
    throw error;
  }
}

export async function uploadFileAction(_: FileManagerState, formData: FormData): Promise<FileManagerState> {
  const denied = await ensureAdmin();
  if (denied) return denied;

  const bucket = formData.get('bucket');
  if (!isStorageBucket(bucket)) return { ok: false, message: '請選擇有效的 bucket。' };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: '請選擇要上傳的檔案。' };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = validateUpload(file, bucket, bytes);
  if (!checked.ok) return { ok: false, message: checked.error };

  const prefix = String(formData.get('prefix') || '');
  const path = buildStoragePath(prefix, buildUploadFileName(file.name, checked.mime));
  const { db, error } = getAdminStorage();
  if (!db) return { ok: false, message: error };

  const upload = await db.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    contentType: checked.mime,
    upsert: false,
  });

  if (upload.error) return { ok: false, message: `上傳失敗：${upload.error.message}` };

  const { data } = db.storage.from(bucket).getPublicUrl(path);
  revalidatePath('/admin/files');
  return { ok: true, message: `已上傳 ${path}`, publicUrl: data.publicUrl };
}

export async function deleteFileAction(_: FileManagerState, formData: FormData): Promise<FileManagerState> {
  const denied = await ensureAdmin();
  if (denied) return denied;

  const bucket = formData.get('bucket');
  if (!isStorageBucket(bucket)) return { ok: false, message: '請選擇有效的 bucket。' };

  const path = cleanPathPart(String(formData.get('path') || ''));
  if (!path) return { ok: false, message: '缺少要刪除的檔案路徑。' };

  const { db, error } = getAdminStorage();
  if (!db) return { ok: false, message: error };

  const removed = await db.storage.from(bucket).remove([path]);
  if (removed.error) return { ok: false, message: `刪除失敗：${removed.error.message}` };

  revalidatePath('/admin/files');
  return { ok: true, message: `已刪除 ${path}` };
}
