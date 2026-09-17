import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/db/admin';
import { allowedStorageMimeTypes } from '../storage-config';

export const runtime = 'nodejs';

const maxFileBytes = 8 * 1024 * 1024;
const bucketName = 'media';
const missingSupabaseMessage = '尚未設定 Supabase 上傳憑證。請先在 .env.local 填入 NEXT_PUBLIC_SUPABASE_URL、NEXT_PUBLIC_SUPABASE_ANON_KEY、SUPABASE_SERVICE_ROLE_KEY，然後重啟 npm run dev。';

function json(status: number, body: { ok: boolean; message: string; publicUrl?: string }) {
  return NextResponse.json(body, { status });
}

function safeExtension(file: File) {
  const extension = file.name.replace(/\\/g, '/').split('/').pop()?.match(/\.[A-Za-z0-9]+$/)?.[0].toLowerCase();
  if (extension && ['.gif', '.jpg', '.jpeg', '.png', '.svg', '.webp'].includes(extension)) return extension;
  if (file.type === 'image/jpeg') return '.jpg';
  if (file.type === 'image/png') return '.png';
  if (file.type === 'image/webp') return '.webp';
  if (file.type === 'image/svg+xml') return '.svg';
  if (file.type === 'image/gif') return '.gif';
  return '';
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
    fileSizeLimit: maxFileBytes,
    allowedMimeTypes: allowedStorageMimeTypes.media,
  });

  return created.error?.message || '';
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json(400, { ok: false, message: '無法讀取上傳表單，請確認檔案小於 8 MB 後再試一次。' });
  }

  const token = String(formData.get('token') || '');
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return json(401, { ok: false, message: '管理密碼不正確，或尚未設定 ADMIN_TOKEN。' });
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return json(400, { ok: false, message: '請選擇要上傳的個人照。' });
  }
  if (file.size > maxFileBytes) {
    return json(400, { ok: false, message: '照片不能超過 8 MB。' });
  }
  if (!allowedStorageMimeTypes.media.includes(file.type)) {
    return json(400, { ok: false, message: '個人照請使用 PNG、JPG、WebP、SVG 或 GIF。' });
  }

  const { db, error } = adminClient();
  if (!db) return json(500, { ok: false, message: error });

  const bucketError = await ensureMediaBucket(db);
  if (bucketError) {
    return json(500, { ok: false, message: `無法建立或讀取 media bucket：${bucketError}` });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = `avatar/profile-photo-${timestamp}${safeExtension(file)}`;
  const upload = await db.storage.from(bucketName).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: true,
  });
  if (upload.error) return json(500, { ok: false, message: `上傳失敗：${upload.error.message}` });

  const { data } = db.storage.from(bucketName).getPublicUrl(path);
  const saved = await db.from('profile').update({
    avatar_url: data.publicUrl,
    updated_at: new Date().toISOString(),
  }).eq('id', 1);
  if (saved.error) return json(500, { ok: false, message: `更新個人照失敗：${saved.error.message}` });

  revalidateTag('profile');
  revalidatePath('/zh');
  revalidatePath('/en');
  revalidatePath('/admin/files');

  return json(200, { ok: true, message: '個人照已更新，前台會顯示新照片。', publicUrl: data.publicUrl });
}
