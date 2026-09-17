import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { isUnauthorizedError, requireAdmin } from '@/lib/auth/admin';
import { adminDb } from '@/lib/db/admin';
import { allowedStorageMimeTypes, buildUploadFileName, maxUploadBytes, storagePathFromPublicUrl, validateUpload } from '@/lib/uploads';

export const runtime = 'nodejs';

const bucketName = 'media';
const missingSupabaseMessage = '尚未設定 Supabase 上傳憑證。請先在 .env.local 填入 NEXT_PUBLIC_SUPABASE_URL、NEXT_PUBLIC_SUPABASE_ANON_KEY、SUPABASE_SERVICE_ROLE_KEY，然後重啟 npm run dev。';

function json(status: number, body: { ok: boolean; message: string; publicUrl?: string }) {
  return NextResponse.json(body, { status });
}

function adminClient() {
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

async function ensureMediaBucket(db: ReturnType<typeof adminDb>) {
  const existing = await db.storage.getBucket(bucketName);
  if (!existing.error) return '';

  const message = existing.error.message.toLowerCase();
  if (!message.includes('not found')) return existing.error.message;

  const created = await db.storage.createBucket(bucketName, {
    public: true,
    fileSizeLimit: maxUploadBytes,
    allowedMimeTypes: allowedStorageMimeTypes.media,
  });

  return created.error?.message || '';
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (error) {
    if (isUnauthorizedError(error)) return json(401, { ok: false, message: '請先登入管理員帳號。' });
    throw error;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json(400, { ok: false, message: '無法讀取上傳表單，請確認檔案小於 8 MB 後再試一次。' });
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return json(400, { ok: false, message: '請選擇要上傳的個人照。' });
  }
  if (file.size > maxUploadBytes) {
    return json(400, { ok: false, message: '照片不能超過 8 MB。' });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = validateUpload(file, bucketName, bytes);
  if (!checked.ok) return json(400, { ok: false, message: '個人照請使用 PNG、JPG、WebP 或 GIF。' });

  const { db, error } = adminClient();
  if (!db) return json(500, { ok: false, message: error });

  const bucketError = await ensureMediaBucket(db);
  if (bucketError) {
    return json(500, { ok: false, message: `無法建立或讀取 media bucket：${bucketError}` });
  }

  const previous = await db.from('profile').select('avatar_url').eq('id', 1).maybeSingle();
  const previousPath = storagePathFromPublicUrl(previous.data?.avatar_url, bucketName);

  const path = `avatar/${buildUploadFileName(file.name, checked.mime)}`;
  const upload = await db.storage.from(bucketName).upload(path, file, {
    cacheControl: '3600',
    contentType: checked.mime,
    upsert: false,
  });
  if (upload.error) return json(500, { ok: false, message: `上傳失敗：${upload.error.message}` });

  const { data } = db.storage.from(bucketName).getPublicUrl(path);
  const saved = await db.from('profile').update({
    avatar_url: data.publicUrl,
    updated_at: new Date().toISOString(),
  }).eq('id', 1);
  if (saved.error) return json(500, { ok: false, message: `更新個人照失敗：${saved.error.message}` });

  let note = '';
  if (previousPath && previousPath !== path) {
    const removed = await db.storage.from(bucketName).remove([previousPath]);
    note = removed.error ? `（舊照片 ${previousPath} 未能刪除，可到檔案管理手動清理。）` : '（舊照片已刪除。）';
  }

  revalidateTag('profile');
  revalidatePath('/zh');
  revalidatePath('/en');
  revalidatePath('/admin/files');

  return json(200, { ok: true, message: `個人照已更新，前台會顯示新照片。${note}`, publicUrl: data.publicUrl });
}
