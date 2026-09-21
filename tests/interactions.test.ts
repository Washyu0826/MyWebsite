import assert from 'node:assert/strict';
import test from 'node:test';
import { previewPosition, previewSize } from '../src/components/cover-preview';

const viewport = { width: 1600, height: 900 };
const row = (top: number, bottom: number, left = 100, right = 1200) => ({ left, top, right, bottom });

test('cover preview: sits beside the row when the viewport has room to its right', () => {
  const spot = previewPosition(row(400, 560), viewport);
  assert.deepEqual(spot, { left: 1220, top: 400 });
});

test('cover preview: goes above the row, flush right, when there is no room beside it', () => {
  const spot = previewPosition(row(400, 560, 100, 1500), viewport);
  assert.deepEqual(spot, { left: 1500 - previewSize.width, top: 400 - 20 - previewSize.height });
});

test('cover preview: is withheld rather than laid over text when it fits nowhere', () => {
  assert.equal(previewPosition(row(40, 200, 100, 1500), viewport), null);
});

test('cover preview: stays inside the viewport whatever the row does', () => {
  for (const r of [row(-300, -100), row(790, 900), row(400, 560, -400, 60)]) {
    const spot = previewPosition(r, viewport);
    if (!spot) continue;
    assert.ok(spot.left >= 12 && spot.left + previewSize.width <= viewport.width - 12, `left ${spot.left}`);
    assert.ok(spot.top >= 12 && spot.top + previewSize.height <= viewport.height - 12, `top ${spot.top}`);
  }
});

test('cover preview: a viewport smaller than the card yields a finite spot or none', () => {
  const spot = previewPosition(row(20, 80), { width: 200, height: 100 });
  assert.ok(spot === null || (Number.isFinite(spot.left) && Number.isFinite(spot.top)));
});
