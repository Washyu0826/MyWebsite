import assert from 'node:assert/strict';
import test from 'node:test';
import { adminEmails, isAdminEmail, safeAdminPath } from '../src/lib/auth/allowlist';
import {
  allowedStorageMimeTypes, buildUploadFileName, cleanPathPart, maxUploadBytes,
  sniffMimeType, storagePathFromPublicUrl, validateUpload,
} from '../src/lib/uploads';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38]);
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

function fileOf(bytes: Uint8Array<ArrayBuffer>, name: string, type: string) {
  return new File([bytes], name, { type });
}

test('upload file names use an ASCII slug, a date, a random suffix and a MIME-derived extension', () => {
  const now = new Date('2026-09-18T10:00:00Z');
  const chinese = buildUploadFileName('個人照.png', 'image/png', now);
  assert.match(chinese, /^upload-20260918-[0-9a-z]{6}\.png$/);
  const latin = buildUploadFileName('My Résumé (Final).PDF', 'application/pdf', now);
  assert.match(latin, /^my-resume-final-20260918-[0-9a-z]{6}\.pdf$/);
  // The extension comes from the sniffed MIME type, never from the user-supplied name.
  assert.match(buildUploadFileName('evil.php.exe', 'image/jpeg', now), /^evil-php-20260918-[0-9a-z]{6}\.jpg$/);
  assert.match(buildUploadFileName('../../etc/passwd', 'image/webp', now), /^passwd-20260918-[0-9a-z]{6}\.webp$/);
  const long = buildUploadFileName(`${'a'.repeat(80)}.gif`, 'image/gif', now);
  assert.match(long, /^a{40}-20260918-[0-9a-z]{6}\.gif$/);
  assert.throws(() => buildUploadFileName('x.svg', 'image/svg+xml'));
  const names = new Set(Array.from({ length: 50 }, () => buildUploadFileName('same.png', 'image/png', now)));
  assert.equal(names.size, 50);
});

test('sniffMimeType recognises each accepted magic number and rejects everything else', () => {
  assert.equal(sniffMimeType(png), 'image/png');
  assert.equal(sniffMimeType(jpeg), 'image/jpeg');
  assert.equal(sniffMimeType(gif), 'image/gif');
  assert.equal(sniffMimeType(webp), 'image/webp');
  assert.equal(sniffMimeType(pdf), 'application/pdf');
  assert.equal(sniffMimeType(svg), null);
  assert.equal(sniffMimeType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20])), null);
  assert.equal(sniffMimeType(new Uint8Array([0x89, 0x50])), null);
  assert.equal(sniffMimeType(new Uint8Array()), null);
});

test('validateUpload enforces size and the sniffed type per bucket, ignoring the browser MIME type', () => {
  assert.deepEqual(validateUpload(fileOf(png, 'a.png', 'image/png'), 'media', png), { ok: true, mime: 'image/png', error: '' });
  assert.deepEqual(validateUpload(fileOf(pdf, 'cv.pdf', 'application/pdf'), 'resume', pdf), { ok: true, mime: 'application/pdf', error: '' });
  // Browser says PNG but the bytes are an SVG: rejected.
  assert.equal(validateUpload(fileOf(svg, 'logo.png', 'image/png'), 'media', svg).ok, false);
  // Wrong bucket for the content.
  assert.equal(validateUpload(fileOf(png, 'a.png', 'image/png'), 'resume', png).ok, false);
  assert.equal(validateUpload(fileOf(pdf, 'a.pdf', 'application/pdf'), 'media', pdf).ok, false);
  // Browser lies about type but bytes are a real JPEG: accepted with the sniffed type.
  assert.equal(validateUpload(fileOf(jpeg, 'photo.txt', 'text/plain'), 'media', jpeg).mime, 'image/jpeg');
  const big = new Uint8Array(maxUploadBytes + 1);
  big.set(png);
  const tooLarge = validateUpload(fileOf(big, 'big.png', 'image/png'), 'media', big);
  assert.equal(tooLarge.ok, false);
  assert.match(tooLarge.error, /8 MB/);
  assert.equal(validateUpload(fileOf(new Uint8Array(), 'empty.png', 'image/png'), 'media', new Uint8Array()).ok, false);
  assert.ok(!allowedStorageMimeTypes.media.includes('image/svg+xml'));
});

test('storage helpers keep paths inside the bucket', () => {
  assert.equal(cleanPathPart('..\\..\\avatar/./x.png'), 'avatar/x.png');
  assert.equal(cleanPathPart(' / '), '');
  const url = 'https://abc.supabase.co/storage/v1/object/public/media/avatar/photo-20260918-ab12cd.png?t=1';
  assert.equal(storagePathFromPublicUrl(url, 'media'), 'avatar/photo-20260918-ab12cd.png');
  assert.equal(storagePathFromPublicUrl(url, 'resume'), null);
  assert.equal(storagePathFromPublicUrl('https://example.com/other.png', 'media'), null);
  assert.equal(storagePathFromPublicUrl(null, 'media'), null);
  assert.equal(storagePathFromPublicUrl('https://abc.supabase.co/storage/v1/object/public/resume/zh/%E5%B1%A5%E6%AD%B7.pdf', 'resume'), 'zh/履歷.pdf');
});

test('isAdminEmail is case-insensitive and accepts a comma-separated list', () => {
  const list = ' Owner@Example.com , second@example.com,,';
  assert.deepEqual(adminEmails(list), ['owner@example.com', 'second@example.com']);
  assert.equal(isAdminEmail('owner@example.com', list), true);
  assert.equal(isAdminEmail('OWNER@EXAMPLE.COM ', list), true);
  assert.equal(isAdminEmail('second@example.com', list), true);
  assert.equal(isAdminEmail('intruder@example.com', list), false);
  assert.equal(isAdminEmail('', list), false);
  assert.equal(isAdminEmail(null, list), false);
  assert.equal(isAdminEmail('owner@example.com', ''), false);
  assert.equal(isAdminEmail('owner@example.com', undefined), Boolean(process.env.ADMIN_EMAIL) && isAdminEmail('owner@example.com', process.env.ADMIN_EMAIL));
});

test('post-login redirect only accepts paths inside /admin', () => {
  assert.equal(safeAdminPath('/admin/files?bucket=media'), '/admin/files?bucket=media');
  assert.equal(safeAdminPath('/admin'), '/admin');
  assert.equal(safeAdminPath('/admin/login?next=/admin'), '/admin');
  assert.equal(safeAdminPath('//evil.com/admin'), '/admin');
  assert.equal(safeAdminPath('/admin//evil.com'), '/admin');
  assert.equal(safeAdminPath('/administrator'), '/admin');
  assert.equal(safeAdminPath('https://evil.com/admin'), '/admin');
  assert.equal(safeAdminPath('/zh'), '/admin');
  assert.equal(safeAdminPath(undefined), '/admin');
});
