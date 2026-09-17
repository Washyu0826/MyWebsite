'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { adminDb } from '@/lib/db/admin';

export type ResumeUploadState = { ok: boolean; message: string };

const maxResumeBytes = 8 * 1024 * 1024;

export async function uploadResumeAction(_: ResumeUploadState, formData: FormData): Promise<ResumeUploadState> {
  const token = String(formData.get('token') || '');
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return { ok: false, message: '管理密碼不正確，或尚未設定 ADMIN_TOKEN。' };
  }

  const locale = formData.get('locale');
  if (locale !== 'zh' && locale !== 'en') {
    return { ok: false, message: '請選擇中文或英文履歷。' };
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: '請選擇一份 PDF 履歷。' };
  }
  if (file.size > maxResumeBytes) {
    return { ok: false, message: 'PDF 不能超過 8 MB。' };
  }
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return { ok: false, message: '目前只接受 PDF 檔案。' };
  }

  const db = adminDb();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const storagePath = `${locale}/resume-${timestamp}.pdf`;
  const upload = await db.storage.from('resume').upload(storagePath, file, {
    cacheControl: '3600',
    contentType: 'application/pdf',
    upsert: true,
  });
  if (upload.error) return { ok: false, message: `上傳失敗：${upload.error.message}` };

  const { data } = db.storage.from('resume').getPublicUrl(storagePath);
  const update = locale === 'en'
    ? { resume_en_url: data.publicUrl, resume_updated_at: new Date().toISOString() }
    : { resume_zh_url: data.publicUrl, resume_updated_at: new Date().toISOString() };
  const saved = await db.from('profile').update(update).eq('id', 1);
  if (saved.error) return { ok: false, message: `資料庫更新失敗：${saved.error.message}` };

  revalidateTag('profile');
  revalidatePath('/zh');
  revalidatePath('/en');
  revalidatePath('/zh/contact');
  revalidatePath('/en/contact');
  return { ok: true, message: `${locale === 'zh' ? '中文' : '英文'}履歷已更新。` };
}
