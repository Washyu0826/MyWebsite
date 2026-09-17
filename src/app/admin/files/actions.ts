'use server';

import { revalidatePath } from 'next/cache';
import { revalidateTag } from 'next/cache';
import { adminDb } from '@/lib/db/admin';
import { allowedStorageMimeTypes, storageBuckets, type StorageBucket } from './storage-config';

export type FileManagerState = { ok: boolean; message: string; publicUrl?: string };

const maxFileBytes = 8 * 1024 * 1024;
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

function isStorageBucket(value: FormDataEntryValue | null): value is StorageBucket {
  return typeof value === 'string' && storageBuckets.includes(value as StorageBucket);
}

function validateToken(formData: FormData) {
  const token = String(formData.get('token') || '');
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return '管理密碼不正確，或尚未設定 ADMIN_TOKEN。';
  }
  return '';
}

function cleanPathPart(value: string) {
  return value
    .replace(/\\/g, '/')
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part && part !== '.' && part !== '..')
    .join('/');
}

function cleanFileName(value: string) {
  const fileName = value.replace(/\\/g, '/').split('/').pop() || 'upload';
  const cleaned = fileName
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w.\-]/g, '');
  return cleaned || `upload-${Date.now()}`;
}

function buildStoragePath(prefix: string, fileName: string) {
  const cleanPrefix = cleanPathPart(prefix);
  const cleanName = cleanFileName(fileName);
  return cleanPrefix ? `${cleanPrefix}/${cleanName}` : cleanName;
}

export async function uploadFileAction(_: FileManagerState, formData: FormData): Promise<FileManagerState> {
  const tokenError = validateToken(formData);
  if (tokenError) return { ok: false, message: tokenError };

  const bucket = formData.get('bucket');
  if (!isStorageBucket(bucket)) return { ok: false, message: '請選擇有效的 bucket。' };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: '請選擇要上傳的檔案。' };
  }
  if (file.size > maxFileBytes) {
    return { ok: false, message: '檔案不能超過 8 MB。' };
  }

  const allowed = allowedStorageMimeTypes[bucket];
  const lowerName = file.name.toLowerCase();
  const isPdf = bucket === 'resume' && lowerName.endsWith('.pdf');
  if (!allowed.includes(file.type) && !isPdf) {
    return { ok: false, message: `${bucket} bucket 不接受這個檔案格式。` };
  }

  const prefix = String(formData.get('prefix') || '');
  const path = buildStoragePath(prefix, file.name);
  const { db, error } = getAdminStorage();
  if (!db) return { ok: false, message: error };

  const upload = await db.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || undefined,
    upsert: true,
  });

  if (upload.error) return { ok: false, message: `上傳失敗：${upload.error.message}` };

  const { data } = db.storage.from(bucket).getPublicUrl(path);
  revalidatePath('/admin/files');
  return { ok: true, message: `已上傳 ${path}`, publicUrl: data.publicUrl };
}

export async function updateProfilePhotoAction(_: FileManagerState, formData: FormData): Promise<FileManagerState> {
  const tokenError = validateToken(formData);
  if (tokenError) return { ok: false, message: tokenError };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: '請選擇要上傳的個人照。' };
  }
  if (file.size > maxFileBytes) {
    return { ok: false, message: '照片不能超過 8 MB。' };
  }
  if (!allowedStorageMimeTypes.media.includes(file.type)) {
    return { ok: false, message: '個人照請使用 PNG、JPG、WebP、SVG 或 GIF。' };
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = buildStoragePath('avatar', `profile-photo-${timestamp}-${file.name}`);
  const { db, error } = getAdminStorage();
  if (!db) return { ok: false, message: error };

  const upload = await db.storage.from('media').upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: true,
  });
  if (upload.error) return { ok: false, message: `上傳失敗：${upload.error.message}` };

  const { data } = db.storage.from('media').getPublicUrl(path);
  const saved = await db.from('profile').update({
    avatar_url: data.publicUrl,
    updated_at: new Date().toISOString(),
  }).eq('id', 1);
  if (saved.error) return { ok: false, message: `更新個人照失敗：${saved.error.message}` };

  revalidateTag('profile');
  revalidatePath('/zh');
  revalidatePath('/en');
  revalidatePath('/admin/files');
  return { ok: true, message: '個人照已更新，前台會顯示新照片。', publicUrl: data.publicUrl };
}

export async function deleteFileAction(_: FileManagerState, formData: FormData): Promise<FileManagerState> {
  const tokenError = validateToken(formData);
  if (tokenError) return { ok: false, message: tokenError };

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
