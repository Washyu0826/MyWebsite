'use server';

import { requireAdmin } from '@/lib/auth/admin';

export type ResumeUploadState = { ok: boolean; message: string };

export async function uploadResumeAction(): Promise<ResumeUploadState> {
  await requireAdmin();
  return { ok: false, message: '請重新整理頁面後上傳，舊履歷將保留於素材庫。' };
}
