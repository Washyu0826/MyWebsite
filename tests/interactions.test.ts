import assert from 'node:assert/strict';
import test from 'node:test';
import { previewPosition, previewSize } from '../src/components/cover-preview';

const viewport = { width: 1280, height: 800 };

test('cover preview: sits to the right of the cursor and is vertically centred on it', () => {
  const { left, top } = previewPosition(400, 400, viewport);
  assert.equal(left, 420);
  assert.equal(top, 400 - previewSize.height / 2);
});

test('cover preview: flips to the left of the cursor rather than running past the right edge', () => {
  assert.equal(previewPosition(1200, 400, viewport).left, 1200 - 20 - previewSize.width);
});

test('cover preview: stays inside the viewport at every edge', () => {
  for (const [x, y] of [[0, 0], [1279, 799], [640, 5], [4, 795]]) {
    const { left, top } = previewPosition(x, y, viewport);
    assert.ok(left >= 12 && left + previewSize.width <= viewport.width - 12, `left ${left}`);
    assert.ok(top >= 12 && top + previewSize.height <= viewport.height - 12, `top ${top}`);
  }
});

test('cover preview: a viewport smaller than the card still yields a finite position', () => {
  const { left, top } = previewPosition(100, 100, { width: 200, height: 100 });
  assert.ok(Number.isFinite(left) && Number.isFinite(top));
});
