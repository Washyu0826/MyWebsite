// Image pipeline helpers: dimension sniffing, blur placeholders, WebP conversion and EXIF stripping.
//
// The top half is pure (no Node, Next or Supabase imports) so it can be unit tested with `tsx --test`.
// The bottom half lazily imports `sharp` and the Supabase clients, so importing this module from a
// test or an edge runtime never pulls them in.
//
// Integration note for the public site: `getImageMetaMap()` returns `{}` for every URL uploaded before
// this pipeline existed, so `next/image` callers must treat width/height/blurDataURL as optional.

import type sharpNamespace from 'sharp';

export type ImageSize = { width: number; height: number };

/** Longest edge kept for uploaded images; anything larger is downscaled before storage. */
export const maxImageDimension = 2000;
/** Width of the blur placeholder. 12px keeps the data URL around 200-400 bytes. */
export const blurPlaceholderWidth = 12;

function u16be(bytes: Uint8Array, at: number) {
  return (bytes[at] << 8) | bytes[at + 1];
}

function u16le(bytes: Uint8Array, at: number) {
  return bytes[at] | (bytes[at + 1] << 8);
}

function u24le(bytes: Uint8Array, at: number) {
  return bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16);
}

function ascii(bytes: Uint8Array, at: number, length: number) {
  return String.fromCharCode(...bytes.subarray(at, at + length));
}

function pngSize(bytes: Uint8Array): ImageSize | null {
  // IHDR is always the first chunk: 8 byte signature, 4 byte length, 'IHDR', width, height.
  if (bytes.length < 24 || ascii(bytes, 12, 4) !== 'IHDR') return null;
  return { width: (u16be(bytes, 16) << 16) | u16be(bytes, 18), height: (u16be(bytes, 20) << 16) | u16be(bytes, 22) };
}

function gifSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 10) return null;
  return { width: u16le(bytes, 6), height: u16le(bytes, 8) };
}

function jpegSize(bytes: Uint8Array): ImageSize | null {
  // Walk the segment chain until a start-of-frame marker carries the real dimensions.
  let at = 2;
  while (at + 8 < bytes.length) {
    if (bytes[at] !== 0xff) { at += 1; continue; }
    const marker = bytes[at + 1];
    if (marker === 0xff || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) { at += 2; continue; }
    const length = u16be(bytes, at + 2);
    if (length < 2) return null;
    const isFrame = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7)
      || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
    if (isFrame) return { width: u16be(bytes, at + 7), height: u16be(bytes, at + 5) };
    at += 2 + length;
  }
  return null;
}

function webpSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 30) return null;
  const chunk = ascii(bytes, 12, 4);
  if (chunk === 'VP8 ') return { width: u16le(bytes, 26) & 0x3fff, height: u16le(bytes, 28) & 0x3fff };
  if (chunk === 'VP8L') {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') return { width: u24le(bytes, 24) + 1, height: u24le(bytes, 27) + 1 };
  return null;
}

/** Pixel dimensions straight from the file header. Returns null for anything unrecognised or truncated. */
export function readImageSize(bytes: Uint8Array): ImageSize | null {
  let size: ImageSize | null = null;
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG') size = pngSize(bytes);
  else if (ascii(bytes, 0, 4) === 'GIF8') size = gifSize(bytes);
  else if (bytes[0] === 0xff && bytes[1] === 0xd8) size = jpegSize(bytes);
  else if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') size = webpSize(bytes);
  if (!size || !Number.isFinite(size.width) || !Number.isFinite(size.height)) return null;
  if (size.width < 1 || size.height < 1 || size.width > 65_535 || size.height > 65_535) return null;
  return size;
}

/** Downscales to fit `max` on the longest edge, keeping the aspect ratio. Never enlarges. */
export function fitWithin(size: ImageSize, max: number = maxImageDimension): ImageSize {
  const longest = Math.max(size.width, size.height);
  if (longest <= max) return { width: size.width, height: size.height };
  const ratio = max / longest;
  return { width: Math.max(1, Math.round(size.width * ratio)), height: Math.max(1, Math.round(size.height * ratio)) };
}

const blurDataUrlPattern = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Guards what we accept from the database, so a bad row cannot become an arbitrary `src`. */
export function isBlurDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 4096 && blurDataUrlPattern.test(value);
}

export type ImageMeta = { width: number; height: number; blurDataUrl: string | null };

/** Row -> ImageMeta, dropping anything malformed. Unknown images simply have no metadata. */
export function toImageMeta(row: unknown): ImageMeta | null {
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  const width = Number(record.width);
  const height = Number(record.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) return null;
  return { width, height, blurDataUrl: isBlurDataUrl(record.blur_data_url) ? record.blur_data_url : null };
}

// ---------------------------------------------------------------------------
// sharp-backed processing (server only, lazily loaded)
// ---------------------------------------------------------------------------

export type ProcessedImage = {
  bytes: Uint8Array;
  mime: string;
  width: number;
  height: number;
  blurDataUrl: string | null;
  /** false when the original bytes were kept (animated GIF, or sharp unavailable). */
  converted: boolean;
};

type SharpFactory = typeof sharpNamespace;

let sharpModule: SharpFactory | null | undefined;

/** `sharp` ships with Next as an optional native binary; a platform without it must not break uploads. */
async function loadSharp(): Promise<SharpFactory | null> {
  if (sharpModule !== undefined) return sharpModule;
  try {
    sharpModule = (await import('sharp')).default;
  } catch {
    sharpModule = null;
  }
  return sharpModule;
}

/**
 * Converts an uploaded image to WebP, caps the longest edge at `maxImageDimension`, drops every EXIF
 * block (GPS coordinates included) and renders a blur placeholder. Animated GIFs keep their original
 * bytes so the animation survives; they are only measured. Returns null when the bytes are unreadable.
 */
export async function processUploadImage(input: Uint8Array, mime: string): Promise<ProcessedImage | null> {
  const header = readImageSize(input);
  const sharp = await loadSharp();

  if (!sharp) {
    // No encoder: keep the original file and store whatever the header told us.
    return header ? { bytes: input, mime, ...header, blurDataUrl: null, converted: false } : null;
  }

  const source = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  let meta: { width?: number; height?: number; pages?: number };
  try {
    meta = await sharp(source).metadata();
  } catch {
    return header ? { bytes: input, mime, ...header, blurDataUrl: null, converted: false } : null;
  }

  const size = meta.width && meta.height ? { width: meta.width, height: meta.height } : header;
  if (!size) return null;

  const blurDataUrl = await renderBlurPlaceholder(source);
  const animated = mime === 'image/gif' && (meta.pages || 1) > 1;
  if (animated) return { bytes: input, mime, ...size, blurDataUrl, converted: false };

  const target = fitWithin(size);
  try {
    // `rotate()` bakes in the EXIF orientation; sharp writes no metadata unless asked, so EXIF is dropped.
    const output = await sharp(source)
      .rotate()
      .resize({ width: target.width, height: target.height, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    return {
      bytes: new Uint8Array(output.data),
      mime: 'image/webp',
      width: output.info.width,
      height: output.info.height,
      blurDataUrl,
      converted: true,
    };
  } catch {
    return { bytes: input, mime, ...size, blurDataUrl, converted: false };
  }
}

async function renderBlurPlaceholder(source: Buffer): Promise<string | null> {
  const sharp = await loadSharp();
  if (!sharp) return null;
  try {
    const tiny = await sharp(source, { pages: 1 })
      .rotate()
      .resize({ width: blurPlaceholderWidth, fit: 'inside' })
      .webp({ quality: 40, alphaQuality: 60, smartSubsample: true })
      .toBuffer();
    const url = `data:image/webp;base64,${tiny.toString('base64')}`;
    return isBlurDataUrl(url) ? url : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// image_metadata table (supabase/migrations/20260920000200_media_dimensions.sql)
// ---------------------------------------------------------------------------

/**
 * `image_metadata` is added by this feature's own migration and is not in the generated `Database`
 * type, so the queries below go through an untyped client on purpose.
 */
type UntypedDb = { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export type ImageMetaRecord = ImageMeta & {
  publicUrl: string;
  bucket: string;
  objectPath: string;
  mimeType: string;
  byteSize: number;
};

/** Best effort: a missing table or missing credentials must never fail the upload itself. */
export async function saveImageMeta(record: ImageMetaRecord): Promise<boolean> {
  try {
    const { adminDb } = await import('@/lib/db/admin');
    const db = adminDb() as unknown as UntypedDb;
    const { error } = await db.from('image_metadata').upsert({
      public_url: record.publicUrl,
      bucket: record.bucket,
      object_path: record.objectPath,
      width: record.width,
      height: record.height,
      blur_data_url: record.blurDataUrl,
      mime_type: record.mimeType,
      byte_size: record.byteSize,
    }, { onConflict: 'public_url' });
    return !error;
  } catch {
    return false;
  }
}

/** Metadata for the given public URLs. Unknown or legacy URLs are simply absent from the map. */
export async function getImageMetaMap(urls: (string | null | undefined)[]): Promise<Record<string, ImageMeta>> {
  const wanted = [...new Set(urls.filter((url): url is string => typeof url === 'string' && url.startsWith('http')))];
  if (!wanted.length) return {};
  try {
    const { publicDb } = await import('@/lib/db/server');
    const db = publicDb() as unknown as UntypedDb;
    const { data } = await db.from('image_metadata')
      .select('public_url, width, height, blur_data_url')
      .in('public_url', wanted);
    const map: Record<string, ImageMeta> = {};
    for (const row of (data || []) as Record<string, unknown>[]) {
      const meta = toImageMeta(row);
      if (meta && typeof row.public_url === 'string') map[row.public_url] = meta;
    }
    return map;
  } catch {
    return {};
  }
}

export async function getImageMeta(url: string | null | undefined): Promise<ImageMeta | null> {
  if (!url) return null;
  const map = await getImageMetaMap([url]);
  return map[url] || null;
}
