import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { assetMaxBytes, assetName, isPublishSlot, isUuid, sameOriginWrite, shareTokenPattern, validateAssetInput, validateShareInput } from '../src/lib/assets/model';

const input = { name: 'portrait.jpg', mime: 'image/jpeg', size: 100, requestId: '11111111-1111-4111-8111-111111111111' };
test('asset names remain human readable; paths and control characters are not keys', () => {
  assert.equal(assetName('C:\\fakepath\\portrait.jpg'), 'portrait.jpg');
  assert.equal(assetName('../portrait.jpg'), 'portrait.jpg');
  assert.equal(assetName(' e\u0301.jpg '), '\u00e9.jpg');
  assert.throws(() => assetName('a\nb.jpg'), /INVALID_NAME/);
  assert.throws(() => assetName('x'.repeat(241)), /INVALID_NAME/);
  assert.throws(() => assetName(null), /INVALID_NAME/);
});
test('upload input rejects invalid types, identifiers and sizes before signing', () => {
  assert.equal(validateAssetInput(input).size, 100);
  for (const size of [0, -1, 1.5, '100', NaN, Infinity, assetMaxBytes + 1]) assert.throws(() => validateAssetInput({ ...input, size }), /INVALID_SIZE/);
  for (const mime of ['image/svg+xml', 'text/html', 'application/octet-stream', null]) assert.throws(() => validateAssetInput({ ...input, mime }), /INVALID_TYPE/);
  assert.throws(() => validateAssetInput({ ...input, assetId: '../other' }), /INVALID_REQUEST/);
  assert.throws(() => validateAssetInput({ ...input, requestId: '' }), /INVALID_REQUEST/);
  assert.equal(isUuid(input.requestId), true);
});
test('publication slots exclude inherited object properties', () => {
  for (const slot of ['public', 'avatar', 'resume_en', 'resume_zh']) assert.equal(isPublishSlot(slot), true);
  for (const slot of ['__proto__', 'toString', 'constructor', 'media', null]) assert.equal(isPublishSlot(slot), false);
});
test('writes require an exact browser origin and reject cross-site requests', () => {
  const request = (origin?: string, site?: string) => new Request('https://portfolio.example/api/admin/assets', { method: 'POST', headers: { ...(origin ? { Origin: origin } : {}), ...(site ? { 'Sec-Fetch-Site': site } : {}) } });
  assert.equal(sameOriginWrite(request('https://portfolio.example', 'same-origin')), true);
  assert.equal(sameOriginWrite(request('https://attacker.example')), false);
  assert.equal(sameOriginWrite(request('http://portfolio.example')), false);
  assert.equal(sameOriginWrite(request('https://portfolio.example', 'cross-site')), false);
  assert.equal(sameOriginWrite(request()), false);
});
test('share tokens are 32 random bytes in base64url, and only that shape is accepted', () => {
  for (let attempt = 0; attempt < 50; attempt++) {
    assert.match(randomBytes(32).toString('base64url'), shareTokenPattern);
  }
  for (const bad of ['', 'short', `${'a'.repeat(43)}=`, `${'a'.repeat(42)}+`, 'a'.repeat(44), '../../etc/passwd']) {
    assert.equal(shareTokenPattern.test(bad), false, bad);
  }
});
test('share input rejects unusable expiry windows, caps and labels before anything is signed', () => {
  const base = { versionId: '11111111-1111-4111-8111-111111111111', hours: 168 };
  assert.deepEqual(validateShareInput(base), { versionId: base.versionId, hours: 168, maxOpens: null, label: null });
  assert.equal(validateShareInput({ ...base, maxOpens: '5', label: '  面試  ' }).maxOpens, 5);
  assert.equal(validateShareInput({ ...base, label: '  面試  ' }).label, '面試');
  assert.equal(validateShareInput({ ...base, maxOpens: '' }).maxOpens, null);
  for (const hours of [0, 2, 1000, -1, 'week', null]) assert.throws(() => validateShareInput({ ...base, hours }), /INVALID_EXPIRY/);
  for (const maxOpens of [0, -1, 1.5, 10001, 'many']) assert.throws(() => validateShareInput({ ...base, maxOpens }), /INVALID_REQUEST/);
  assert.throws(() => validateShareInput({ ...base, label: 'x'.repeat(121) }), /INVALID_REQUEST/);
  assert.throws(() => validateShareInput({ ...base, label: 'a\nb' }), /INVALID_REQUEST/);
  assert.throws(() => validateShareInput({ ...base, versionId: 'nope' }), /INVALID_REQUEST/);
});
