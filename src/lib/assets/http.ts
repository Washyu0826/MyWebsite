import 'server-only';
import { requireAdmin } from '@/lib/auth/admin';
import { sameOriginWrite } from './model';

const errors: Record<string, [number, string]> = {
  UNAUTHORIZED: [401, '請先登入管理員帳號。'], FORBIDDEN: [403, '請從本站重新送出操作。'],
  INVALID_REQUEST: [400, '請求格式不正確。'], INVALID_NAME: [400, '檔名需為 1–240 個字元。'],
  INVALID_TYPE: [400, '檔案格式不符合此用途。'], INVALID_SIZE: [400, '檔案需大於 0 且不超過 8 MiB。'],
  INVALID_UPLOAD: [400, '上傳資料不完整。'], INVALID_SLOT: [400, '請選擇有效的發布用途。'], INVALID_ACTION: [400, '無效操作。'],
  ASSET_NOT_FOUND: [404, '找不到檔案或沒有存取權限。'], ASSET_TRASHED: [409, '請先從垃圾桶還原檔案。'],
  ASSET_PUBLISHED: [409, '此素材已有公開副本，為保留文章與舊網址，目前不能回收。'],
  ASSET_REFERENCED: [409, '此素材仍被個人資料、作品或文章使用；請先更換那裡的引用，再回收或撤銷。'],
  PUBLICATION_PENDING: [409, '這次發布尚未完成，請先重試發布或等它完成。'],
  OBJECT_REMOVE_FAILED: [503, '公開副本已停止列出，但檔案尚未從儲存區移除；請稍後再按一次撤銷。'],
  INVALID_EXPIRY: [400, '請選擇有效的有效期限。'],
  SHARE_LIMIT: [409, '這個素材的有效分享連結已達 20 個上限，請先撤銷不用的連結。'],
  UPLOAD_PENDING: [409, '此檔案仍有待完成的上傳，請重試驗證或取消該版本。'],
  VERSION_NOT_READY: [409, '此版本尚未通過驗證。'], UPLOAD_REJECTED: [409, '此版本已取消或驗證失敗，請重新上傳新版本。'],
  UPLOAD_MISMATCH: [422, '實際檔案內容、大小或格式不符，請重新選擇檔案。'],
  OBJECT_NOT_AVAILABLE: [409, '檔案尚未傳完，或暫時無法讀取。可稍後重試驗證。'],
  QUOTA_EXCEEDED: [409, '已達素材庫 800 MB 容量預算，舊版與待上傳版本也會計入。'],
  PROFILE_CHANGED: [409, '個人資料已被另一個操作更新。請重新整理後再發布，舊檔仍保留。'],
  REQUEST_CONFLICT: [409, '此操作編號已用於另一個請求。'], PROFILE_NOT_FOUND: [409, '尚未建立個人資料。'],
  BUCKET_NOT_FOUND: [503, '找不到儲存區，請確認 assets-private、media 與 resume buckets 已建立。'],
  'Missing server-side Supabase credentials.': [503, '請設定伺服器的 Supabase URL 與 SUPABASE_SERVICE_ROLE_KEY，然後重新啟動或部署。'],
};
export function assetResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}
export async function assetHandler(request: Request, work: (actor: string) => Promise<unknown>) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAdmin();
    if (request.method !== 'GET' && !sameOriginWrite(request)) throw new Error('FORBIDDEN');
    return assetResponse({ ok: true, data: await work(user.id), requestId });
  } catch (error) {
    const problem = error as { code?: string; message?: string };
    const migration = ['42P01', 'PGRST202', 'PGRST205'].includes(problem.code || '');
    const known = errors[problem.message || ''];
    const [status, message] = migration ? [503, '素材庫資料庫尚未更新，請套用 supabase/migrations 內 20260920 開頭的 asset migration。'] : known || [503, '服務暫時無法完成操作，請保留操作編號並稍後重試。'];
    if (!known && !migration) console.error('Asset operation failed', { requestId, code: problem.code || 'STORAGE_OR_DATABASE_ERROR' });
    return assetResponse({ ok: false, message, requestId, code: known ? problem.message : migration ? 'SETUP_REQUIRED' : 'SERVICE_UNAVAILABLE', setupRequired: migration }, status);
  }
}
export async function assetJson(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('INVALID_REQUEST');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('INVALID_REQUEST');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 16384) { await reader.cancel(); throw new Error('INVALID_REQUEST'); }
    chunks.push(value);
  }
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
    return value as Record<string, unknown>;
  } catch { throw new Error('INVALID_REQUEST'); }
}
