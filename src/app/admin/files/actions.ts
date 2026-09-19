'use server';

import { requireAdmin } from '@/lib/auth/admin';

export type FileManagerState = { ok: boolean; message: string; publicUrl?: string; width?: number; height?: number; blurDataUrl?: string | null };

// Stale browser tabs must not bypass the versioned library or permanently delete objects.
export async function uploadFileAction(): Promise<FileManagerState> {
  await requireAdmin();
  return { ok: false, message: '上傳流程已更新，請重新整理頁面後使用素材庫上傳。' };
}

export async function deleteFileAction(): Promise<FileManagerState> {
  await requireAdmin();
  return { ok: false, message: '永久刪除已停用，請在素材庫使用垃圾桶。' };
}
