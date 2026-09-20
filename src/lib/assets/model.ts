export const privateBucket = 'assets-private';
export const assetMaxBytes = 8 * 1024 * 1024;
export const assetQuotaBytes = 800_000_000;
export const assetMimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'] as const;
export type PublishSlot = 'public' | 'avatar' | 'resume_zh' | 'resume_en';
export type Asset = {
  id: string; owner_id: string; name: string; current_version_id: string | null;
  version_count: number; deleted_at: string | null; created_at: string; updated_at: string;
};
export type AssetVersion = {
  id: string; asset_id: string; owner_id: string; request_id: string; version_no: number;
  original_name: string; object_path: string; mime_type: string; size_bytes: number;
  sha256: string | null; status: 'pending' | 'ready' | 'rejected'; last_error: string | null;
  created_at: string; completed_at: string | null;
};
export type AssetPublication = {
  id: string; owner_id: string; asset_id: string; version_id: string; request_id: string;
  slot: PublishSlot; bucket: 'media' | 'resume'; object_path: string; expected_url: string | null;
  public_url: string | null; status: 'pending' | 'complete' | 'conflict' | 'revoked'; last_error: string | null;
  revoked_at: string | null; purged_at: string | null;
  content_sha256: string | null; content_type: string | null; content_size: number | null;
  created_at: string; completed_at: string | null;
};
export type AssetShare = {
  id: string; asset_id: string; version_id: string; label: string | null;
  expires_at: string; max_opens: number | null; opens: number;
  revoked_at: string | null; last_opened_at: string | null; created_at: string;
};
export type ShareState = 'active' | 'expired' | 'revoked' | 'exhausted' | 'missing';
export type SharePeek = {
  state: ShareState; name?: string; mime_type?: string; size_bytes?: number;
  expires_at?: string; opens?: number; max_opens?: number | null; label?: string | null;
};
/** 32 random bytes, base64url: 43 characters with no padding. */
export const shareTokenPattern = /^[A-Za-z0-9_-]{43}$/;
export const shareHourOptions = [1, 24, 72, 168, 720] as const;
export const shareHourLabels: Record<number, string> = { 1: '1 小時', 24: '1 天', 72: '3 天', 168: '7 天', 720: '30 天' };
export type AssetEvent = { id: number; actor_id: string; asset_id: string; version_id: string | null; action: string; detail: Record<string, unknown>; created_at: string };
export type AssetSummary = Asset & { current: AssetVersion | null; published: boolean };
export type AssetList = { items: AssetSummary[]; count: number; page: number; usedBytes: number };
export type AssetReference = {
  publication_id: string; url: string; kind: 'profile' | 'project' | 'project_media' | 'post' | 'post_revision';
  id: string | null; slug: string | null; title: string | null; field: string;
  /** A retained article revision: it keeps no live page working, so it warns instead of blocking. */
  soft: boolean;
};
export type AssetDetail = { asset: Asset; versions: AssetVersion[]; publications: AssetPublication[]; events: AssetEvent[]; references: AssetReference[]; shares: AssetShare[] };
export type PublishedAsset = { id: string; asset_id: string; name: string; slot: PublishSlot; public_url: string; mime_type: string | null; size: number | null; completed_at: string; width: number | null; height: number | null };
export type PublishedList = { items: PublishedAsset[]; count: number; page: number };
const referenceKinds: Record<AssetReference['kind'], string> = { profile: '個人資料', project: '作品', project_media: '作品畫廊', post: '文章', post_revision: '文章舊版本' };
const referenceFields: Record<string, string> = { cover_url: '封面', architecture_url: '架構圖', body: '內文', media: '媒體', avatar: '個人照', resume_zh: '中文履歷', resume_en: '英文履歷', revision: '修訂紀錄' };
export function referenceLabel(reference: AssetReference) {
  const where = reference.kind === 'profile' ? '' : `：${reference.title || reference.slug || reference.id || ''}`;
  return `${referenceKinds[reference.kind]}${where}（${referenceFields[reference.field] || reference.field}）`;
}
export function referenceHref(reference: AssetReference) {
  if (reference.kind === 'post' || reference.kind === 'post_revision') return `/admin/articles/${reference.id}`;
  if (reference.kind === 'profile') return reference.field.startsWith('resume') ? '/admin/resume' : '/admin/profile';
  return `/admin/projects/${reference.id}`;
}
export const eventLabels: Record<string, string> = {
  'upload.started': '開始上傳', 'upload.verified': '驗證完成', 'upload.rejected': '檔案未通過驗證',
  'upload.retry_needed': '等待重試', 'asset.rename': '重新命名', 'asset.trash': '移至垃圾桶',
  'asset.restore': '從垃圾桶還原', 'asset.version': '切換目前版本', 'asset.cancel': '取消待上傳版本',
  'publish.started': '開始發布', 'publish.complete': '發布完成', 'publish.conflict': '發布衝突',
  'publish.revoked': '撤銷公開副本', 'publish.purged': '公開檔案已移除',
  'share.created': '建立分享連結', 'share.revoked': '撤銷分享連結',
};
export const slotLabels: Record<PublishSlot, string> = { public: '公開連結', avatar: '個人照', resume_zh: '中文履歷', resume_en: '英文履歷' };

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export function assetName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('INVALID_NAME');
  const name = value.replace(/\\/g, '/').split('/').pop()?.normalize('NFC').trim() ?? '';
  if (!name || name.length > 240 || /[\u0000-\u001f\u007f]/.test(name)) throw new Error('INVALID_NAME');
  return name;
}
export function validateAssetInput(input: Record<string, unknown>) {
  const name = assetName(input.name);
  if (!isUuid(input.requestId) || (input.assetId != null && !isUuid(input.assetId))) throw new Error('INVALID_REQUEST');
  if (typeof input.mime !== 'string' || !(assetMimeTypes as readonly string[]).includes(input.mime)) throw new Error('INVALID_TYPE');
  if (typeof input.size !== 'number' || !Number.isSafeInteger(input.size) || input.size <= 0 || input.size > assetMaxBytes) throw new Error('INVALID_SIZE');
  return { name, requestId: input.requestId, assetId: input.assetId as string | undefined, mime: input.mime, size: input.size };
}
export function isPublishSlot(value: unknown): value is PublishSlot {
  return typeof value === 'string' && Object.hasOwn(slotLabels, value);
}
export function validateShareInput(input: Record<string, unknown>) {
  if (!isUuid(input.versionId)) throw new Error('INVALID_REQUEST');
  const hours = Number(input.hours);
  if (!(shareHourOptions as readonly number[]).includes(hours)) throw new Error('INVALID_EXPIRY');
  let maxOpens: number | null = null;
  if (input.maxOpens != null && input.maxOpens !== '') {
    maxOpens = Number(input.maxOpens);
    if (!Number.isSafeInteger(maxOpens) || maxOpens < 1 || maxOpens > 10000) throw new Error('INVALID_REQUEST');
  }
  const raw = typeof input.label === 'string' ? input.label.trim() : '';
  if (raw.length > 120 || /[\u0000-\u001f\u007f]/.test(raw)) throw new Error('INVALID_REQUEST');
  return { versionId: input.versionId, hours, maxOpens, label: raw || null };
}

export function formatAssetBytes(bytes: number) {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.ceil(bytes / 1000)} KB`;
}
export function sameOriginWrite(request: Request): boolean {
  try { return request.headers.get('sec-fetch-site') !== 'cross-site' && new URL(request.headers.get('origin') || '').origin === new URL(request.url).origin; }
  catch { return false; }
}
