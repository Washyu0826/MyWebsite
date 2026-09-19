'use client';

import { sniffMimeType } from '@/lib/uploads';
import { assetMaxBytes, privateBucket, type AssetVersion, type AssetPublication, type PublishSlot } from './model';

export async function assetRequest<T>(body?: Record<string, unknown>, query = '', signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/admin/assets${query}`, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal });
  let result: { ok: boolean; data: T; message?: string; requestId?: string; code?: string };
  try { result = await response.json(); }
  catch { throw new Error(response.status === 413 ? '請改用素材庫直傳檔案。' : '無法讀取伺服器回應，請稍後重試。'); }
  if (!response.ok || !result.ok) throw Object.assign(new Error(`${result.message || '操作失敗。'}${result.requestId ? ` (${result.requestId.slice(0, 8)})` : ''}`), { code: result.code });
  return result.data;
}

export type UploadAttempt = { requestId: string; publishId: string; versionId?: string };
export function newUploadAttempt(): UploadAttempt { return { requestId: crypto.randomUUID(), publishId: crypto.randomUUID() }; }

export async function uploadAsset(file: File, options: {
  attempt: UploadAttempt; assetId?: string; slot?: PublishSlot; signal?: AbortSignal;
  onProgress?: (percentage: number, phase: string) => void;
}): Promise<AssetVersion> {
  if (!file.size || file.size > assetMaxBytes) throw new Error('檔案需大於 0 且不超過 8 MiB。');
  const mime = sniffMimeType(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!mime) throw new Error('請選擇 PNG、JPG、WebP、GIF 或 PDF。');
  options.onProgress?.(0, '準備中');
  const initialized = await assetRequest<{ version: AssetVersion; token: string | null; endpoint: string }>({
    action: 'upload', requestId: options.attempt.requestId, assetId: options.assetId, slot: options.slot, name: file.name, size: file.size, mime,
  }, '', options.signal);
  const { version, token, endpoint } = initialized;
  options.attempt.versionId = version.id;
  if (version.status === 'ready') return version;
  if (!token || version.status !== 'pending') throw new Error('此上傳已取消或未通過驗證，請重新選取檔案。');
  const { Upload } = await import('tus-js-client');
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve();
    };
    const task = new Upload(file, {
      endpoint, headers: { 'x-signature': token },
      metadata: { bucketName: privateBucket, objectName: version.object_path, contentType: mime, cacheControl: '0' },
      chunkSize: 6 * 1024 * 1024, uploadDataDuringCreation: true, removeFingerprintOnSuccess: true,
      retryDelays: [0, 1000, 3000, 5000],
      fingerprint: async () => `asset-upload:${version.id}`,
      onProgress: (sent, total) => options.onProgress?.(Math.round(sent / total * 95), '上傳中'),
      onError: () => finish(new Error('檔案傳輸未完成，可重試續傳或重新驗證已上傳的版本。')),
      onSuccess: () => finish(),
    });
    const abort = () => { void task.abort().finally(() => finish(new Error('已暫停上傳，可按重試續傳。'))); };
    if (options.signal?.aborted) { finish(new Error('已暫停上傳。')); return; }
    options.signal?.addEventListener('abort', abort, { once: true });
    void task.findPreviousUploads().then(previous => {
      if (options.signal?.aborted) return;
      if (previous[0]) task.resumeFromPreviousUpload(previous[0]);
      task.start();
    }).catch(() => finish(new Error('無法讀取續傳紀錄，請重新選取檔案。')));
  }).catch(async error => {
    // The browser may miss Storage's success response. Verify before offering a new upload.
    if (options.signal?.aborted) throw error;
    try { await assetRequest({ action: 'complete', versionId: version.id }); }
    catch { throw error; }
  });
  options.onProgress?.(96, '驗證中');
  const ready = await assetRequest<AssetVersion>({ action: 'complete', versionId: version.id }, '', options.signal);
  options.onProgress?.(100, '已保存');
  return ready;
}

export async function uploadAndPublish(file: File, slot: PublishSlot, attempt: UploadAttempt, onProgress?: (percent: number, phase: string) => void) {
  const version = await uploadAsset(file, { attempt, slot, onProgress });
  onProgress?.(100, '發布中');
  return assetRequest<AssetPublication & { imageMeta: { width: number; height: number } | null }>({ action: 'publish', versionId: version.id, slot, requestId: attempt.publishId });
}
