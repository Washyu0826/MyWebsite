'use client';

import { sniffMimeType } from '@/lib/uploads';
import { assetMaxBytes, type AssetVersion, type AssetPublication, type PublishSlot } from './model';

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
  const initialized = await assetRequest<{ version: AssetVersion; uploadUrl: string | null }>({
    action: 'upload', requestId: options.attempt.requestId, assetId: options.assetId, slot: options.slot, name: file.name, size: file.size, mime,
  }, '', options.signal);
  const { version, uploadUrl } = initialized;
  options.attempt.versionId = version.id;
  if (version.status === 'ready') return version;
  if (!uploadUrl || version.status !== 'pending') throw new Error('此上傳已取消或未通過驗證，請重新選取檔案。');
  await sendToStorage(file, uploadUrl, mime, options).catch(async error => {
    // The browser may miss Storage's success response, or the bytes may already be in place from an
    // earlier attempt. Verify before making the reader upload the file again.
    if (options.signal?.aborted) throw error;
    try { await assetRequest({ action: 'complete', versionId: version.id }); }
    catch { throw error; }
  });
  options.onProgress?.(96, '驗證中');
  const ready = await assetRequest<AssetVersion>({ action: 'complete', versionId: version.id }, '', options.signal);
  options.onProgress?.(100, '已保存');
  return ready;
}

/**
 * The file goes to Storage in one PUT against a signed upload URL the server minted.
 *
 * XMLHttpRequest rather than fetch, because it is still the only way to read upload progress in
 * every browser: fetch cannot report how much of a request body has gone out. `x-upsert` matches
 * the signed URL, so pressing retry overwrites whatever a failed attempt left behind rather than
 * colliding with it.
 */
function sendToStorage(file: File, url: string, mime: string, options: {
  signal?: AbortSignal;
  onProgress?: (percentage: number, phase: string) => void;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve();
    };
    if (options.signal?.aborted) { finish(new Error('已暫停上傳。')); return; }
    options.signal?.addEventListener('abort', abort, { once: true });
    request.open('PUT', url, true);
    request.setRequestHeader('content-type', mime);
    request.setRequestHeader('x-upsert', 'true');
    request.upload.onprogress = event => {
      if (event.lengthComputable) options.onProgress?.(Math.round((event.loaded / event.total) * 95), '上傳中');
    };
    request.onload = () => finish(request.status >= 200 && request.status < 300
      ? undefined
      : new Error(`檔案傳輸未完成（${request.status}），請按重試。`));
    request.onerror = () => finish(new Error('檔案傳輸未完成，請確認網路後按重試。'));
    request.onabort = () => finish(new Error('已暫停上傳，可按重試重新上傳。'));
    request.send(file);
  });
}

export async function uploadAndPublish(file: File, slot: PublishSlot, attempt: UploadAttempt, onProgress?: (percent: number, phase: string) => void) {
  const version = await uploadAsset(file, { attempt, slot, onProgress });
  onProgress?.(100, '發布中');
  return assetRequest<AssetPublication & { imageMeta: { width: number; height: number } | null }>({ action: 'publish', versionId: version.id, slot, requestId: attempt.publishId });
}
