import assert from 'node:assert/strict';
import test from 'node:test';
import { assetMaxBytes, assetName, isPublishSlot, isUuid, sameOriginWrite, validateAssetInput } from '../src/lib/assets/model';

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
