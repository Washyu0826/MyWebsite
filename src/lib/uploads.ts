// Pure upload helpers (no Next/Supabase imports) so they can be unit tested with tsx --test.

export const storageBuckets = ['media', 'resume'] as const;
export type StorageBucket = (typeof storageBuckets)[number];

export const allowedStorageMimeTypes: Record<StorageBucket, string[]> = {
  media: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  resume: ['application/pdf'],
};

export const maxUploadBytes = 8 * 1024 * 1024;

/** MIME types the image pipeline (src/lib/images.ts) can measure, convert and blur. */
export const imageMimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

export function isImageMime(mime: string): boolean {
  return (imageMimeTypes as readonly string[]).includes(mime);
}

const extensionByMime: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

export type UploadValidation =
  | { ok: true; mime: string; error: '' }
  | { ok: false; mime: null; error: string };

export function isStorageBucket(value: unknown): value is StorageBucket {
  return typeof value === 'string' && (storageBuckets as readonly string[]).includes(value);
}

export function cleanPathPart(value: string): string {
  return value
    .replace(/\\/g, '/')
    .split('/')
    .map(part => part.trim())
    .filter(part => part && part !== '.' && part !== '..')
    .join('/');
}

export function buildStoragePath(prefix: string, fileName: string): string {
  const cleanPrefix = cleanPathPart(prefix);
  return cleanPrefix ? `${cleanPrefix}/${fileName}` : fileName;
}

/** ASCII-safe slug of a file stem: lowercase [a-z0-9-], max 40 chars; '' when nothing survives (e.g. Chinese names). */
export function slugifyStem(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

function randomBase36(length: number): string {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
}

/** `<stem>-<yyyymmdd>-<6 random base36>.<ext>`; ext comes from the validated MIME type, never from user input. */
export function buildUploadFileName(originalName: string, mime: string, now: Date = new Date()): string {
  const ext = extensionByMime[mime];
  if (!ext) throw new Error(`Unsupported MIME type: ${mime}`);
  const baseName = originalName.replace(/\\/g, '/').split('/').pop() || '';
  const stemSource = baseName.includes('.') ? baseName.slice(0, baseName.lastIndexOf('.')) : baseName;
  const stem = slugifyStem(stemSource) || 'upload';
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `${stem}-${date}-${randomBase36(6)}.${ext}`;
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/** Detects the real file type from magic bytes. Returns null for anything we do not accept. */
export function sniffMimeType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return 'image/png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'image/gif';
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return 'application/pdf';
  return null;
}

/** Size + magic-byte check. The browser-supplied file.type is ignored; only the sniffed type counts. */
export function validateUpload(file: File, bucket: StorageBucket, bytes: Uint8Array): UploadValidation {
  if (file.size === 0 || bytes.length === 0) return { ok: false, mime: null, error: '檔案是空的。' };
  if (file.size > maxUploadBytes || bytes.length > maxUploadBytes) return { ok: false, mime: null, error: '檔案不能超過 8 MB。' };
  const mime = sniffMimeType(bytes);
  if (!mime || !allowedStorageMimeTypes[bucket].includes(mime)) {
    const accepted = bucket === 'resume' ? 'PDF' : 'PNG、JPG、WebP 或 GIF';
    return { ok: false, mime: null, error: `${bucket} bucket 只接受 ${accepted}，且檔案內容必須是真正的該格式。` };
  }
  return { ok: true, mime, error: '' };
}

/** Storage object path from a Supabase public URL, only when it lives in `bucket`. */
export function storagePathFromPublicUrl(publicUrl: string | null | undefined, bucket: StorageBucket): string | null {
  if (!publicUrl) return null;
  const match = publicUrl.match(/\/storage\/v1\/object\/public\/([^/?#]+)\/([^?#]+)/);
  if (!match || match[1] !== bucket) return null;
  try {
    const path = cleanPathPart(match[2].split('/').map(part => decodeURIComponent(part)).join('/'));
    return path || null;
  } catch {
    return null;
  }
}
