import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fitWithin, isBlurDataUrl, maxImageDimension, processUploadImage, readImageSize, toImageMeta,
} from '../src/lib/images';
import { imageMimeTypes, isImageMime } from '../src/lib/uploads';

function bytes(values: number[], length = values.length) {
  const buffer = new Uint8Array(length);
  buffer.set(values);
  return buffer;
}

function ascii(text: string) {
  return [...text].map(character => character.charCodeAt(0));
}

function png(width: number, height: number) {
  return bytes([
    0x89, ...ascii('PNG'), 0x0d, 0x0a, 0x1a, 0x0a,
    0, 0, 0, 13, ...ascii('IHDR'),
    (width >> 24) & 0xff, (width >> 16) & 0xff, (width >> 8) & 0xff, width & 0xff,
    (height >> 24) & 0xff, (height >> 16) & 0xff, (height >> 8) & 0xff, height & 0xff,
  ]);
}

function gif(width: number, height: number) {
  return bytes([...ascii('GIF89a'), width & 0xff, width >> 8, height & 0xff, height >> 8]);
}

function jpeg(width: number, height: number) {
  return bytes([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, // APP0 segment that must be skipped
    0xff, 0xc0, 0x00, 0x11, 0x08,
    (height >> 8) & 0xff, height & 0xff, (width >> 8) & 0xff, width & 0xff,
  ]);
}

function webpLossy(width: number, height: number) {
  const buffer = bytes([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP'), ...ascii('VP8 ')], 32);
  buffer[26] = width & 0xff; buffer[27] = (width >> 8) & 0x3f;
  buffer[28] = height & 0xff; buffer[29] = (height >> 8) & 0x3f;
  return buffer;
}

function webpLossless(width: number, height: number) {
  const buffer = bytes([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP'), ...ascii('VP8L')], 32);
  buffer[20] = 0x2f;
  const packed = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
  buffer[21] = packed & 0xff;
  buffer[22] = (packed >>> 8) & 0xff;
  buffer[23] = (packed >>> 16) & 0xff;
  buffer[24] = (packed >>> 24) & 0xff;
  return buffer;
}

function webpExtended(width: number, height: number) {
  const buffer = bytes([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP'), ...ascii('VP8X')], 32);
  const w = width - 1;
  const h = height - 1;
  buffer[24] = w & 0xff; buffer[25] = (w >> 8) & 0xff; buffer[26] = (w >> 16) & 0xff;
  buffer[27] = h & 0xff; buffer[28] = (h >> 8) & 0xff; buffer[29] = (h >> 16) & 0xff;
  return buffer;
}

test('readImageSize reads the intrinsic size out of every accepted image header', () => {
  assert.deepEqual(readImageSize(png(1920, 1080)), { width: 1920, height: 1080 });
  assert.deepEqual(readImageSize(png(1, 1)), { width: 1, height: 1 });
  assert.deepEqual(readImageSize(gif(640, 480)), { width: 640, height: 480 });
  // The APP0 segment in front of the frame header must be skipped, not misread.
  assert.deepEqual(readImageSize(jpeg(4032, 3024)), { width: 4032, height: 3024 });
  assert.deepEqual(readImageSize(webpLossy(800, 600)), { width: 800, height: 600 });
  assert.deepEqual(readImageSize(webpLossless(300, 200)), { width: 300, height: 200 });
  assert.deepEqual(readImageSize(webpExtended(5000, 4000)), { width: 5000, height: 4000 });
});

test('readImageSize returns null for anything it cannot trust', () => {
  assert.equal(readImageSize(new Uint8Array(0)), null);
  assert.equal(readImageSize(bytes(ascii('%PDF-1.4'))), null);
  assert.equal(readImageSize(bytes(ascii('<svg xmlns="http://www.w3.org/2000/svg" />'))), null);
  // Truncated PNG: the signature matches but IHDR never arrives.
  assert.equal(readImageSize(bytes([0x89, ...ascii('PNG'), 0x0d, 0x0a, 0x1a, 0x0a])), null);
  assert.equal(readImageSize(png(0, 100)), null);
  assert.equal(readImageSize(bytes([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP'), ...ascii('XXXX')], 32)), null);
});

test('fitWithin caps the longest edge, keeps the ratio and never enlarges', () => {
  assert.deepEqual(fitWithin({ width: 4000, height: 3000 }, 2000), { width: 2000, height: 1500 });
  assert.deepEqual(fitWithin({ width: 3000, height: 6000 }, 2000), { width: 1000, height: 2000 });
  assert.deepEqual(fitWithin({ width: 800, height: 600 }, 2000), { width: 800, height: 600 });
  assert.deepEqual(fitWithin({ width: 1, height: 9000 }, 2000), { width: 1, height: 2000 });
  assert.equal(Math.max(...Object.values(fitWithin({ width: 9000, height: 100 }))), maxImageDimension);
});

test('isBlurDataUrl only accepts a small base64 image data URL', () => {
  assert.equal(isBlurDataUrl('data:image/webp;base64,UklGRg=='), true);
  assert.equal(isBlurDataUrl('data:image/jpeg;base64,/9j/4AAQ'), true);
  assert.equal(isBlurDataUrl('data:image/svg+xml;base64,PHN2Zz4='), false);
  assert.equal(isBlurDataUrl('https://example.com/blur.webp'), false);
  assert.equal(isBlurDataUrl('javascript:alert(1)'), false);
  assert.equal(isBlurDataUrl(`data:image/webp;base64,${'A'.repeat(5000)}`), false);
  assert.equal(isBlurDataUrl(null), false);
});

test('toImageMeta keeps usable rows and drops the rest, so legacy images simply have no metadata', () => {
  assert.deepEqual(toImageMeta({ width: 1200, height: 675, blur_data_url: 'data:image/webp;base64,UklGRg==' }),
    { width: 1200, height: 675, blurDataUrl: 'data:image/webp;base64,UklGRg==' });
  assert.deepEqual(toImageMeta({ width: 10, height: 10, blur_data_url: null }), { width: 10, height: 10, blurDataUrl: null });
  // A poisoned placeholder must never reach next/image; the size still is usable.
  assert.deepEqual(toImageMeta({ width: 10, height: 10, blur_data_url: 'javascript:alert(1)' }), { width: 10, height: 10, blurDataUrl: null });
  assert.equal(toImageMeta({ width: 0, height: 10 }), null);
  assert.equal(toImageMeta({ width: 'big', height: 10 }), null);
  assert.equal(toImageMeta(null), null);
});

test('isImageMime covers exactly the formats the pipeline can process', () => {
  assert.deepEqual([...imageMimeTypes], ['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
  assert.equal(isImageMime('image/png'), true);
  assert.equal(isImageMime('application/pdf'), false);
  assert.equal(isImageMime('image/svg+xml'), false);
});

test('processUploadImage converts to WebP, caps the size, strips EXIF and renders a blur placeholder', async t => {
  let sharp: typeof import('sharp').default;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    t.skip('sharp is not installed on this platform');
    return;
  }

  const source = await sharp({ create: { width: 3200, height: 1600, channels: 3, background: { r: 200, g: 40, b: 40 } } })
    // GPS is a real EXIF IFD; sharp's typings only name IFD0/IFD1/IFD2/IFD3, hence the cast.
    .withExifMerge({ IFD0: { Copyright: 'test' }, GPS: { GPSLatitudeRef: 'N' } } as Parameters<ReturnType<typeof sharp>['withExifMerge']>[0])
    .jpeg()
    .toBuffer();
  assert.ok(await sharp(source).metadata().then(meta => !!meta.exif), 'fixture must carry EXIF to begin with');

  const processed = await processUploadImage(new Uint8Array(source), 'image/jpeg');
  assert.ok(processed);
  assert.equal(processed.converted, true);
  assert.equal(processed.mime, 'image/webp');
  assert.deepEqual({ width: processed.width, height: processed.height }, { width: 2000, height: 1000 });
  assert.ok(isBlurDataUrl(processed.blurDataUrl));
  assert.ok(processed.blurDataUrl!.length < 2000);

  const out = await sharp(Buffer.from(processed.bytes)).metadata();
  assert.equal(out.format, 'webp');
  assert.equal(out.exif, undefined, 'EXIF (GPS included) must not survive the conversion');
});
