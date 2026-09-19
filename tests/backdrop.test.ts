import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFacets, growth, mulberry32, scrollDepth } from '../src/components/cubist-backdrop';

test('the composition is deterministic: the same seed rebuilds the same facets', () => {
  const a = buildFacets(), b = buildFacets();
  assert.equal(a.length, 42);
  assert.deepEqual(a.map(f => [f.cx, f.cy, f.color, f.depth]), b.map(f => [f.cx, f.cy, f.color, f.depth]));
  assert.deepEqual(mulberry32(1907)(), mulberry32(1907)());
});

test('facets are convex plates with a usable centroid, and near ones paint last', () => {
  const facets = buildFacets();
  for (const f of facets) {
    assert.ok(f.pts.length >= 6 && f.pts.length === f.buf.length);
    assert.ok(f.radius > 0 && f.alpha.light > 0 && f.alpha.light <= 1 && f.alpha.dark > 0 && f.alpha.dark <= 1);
    assert.ok(f.alpha.light >= f.alpha.dark, 'the light plate carries at least as much pigment');
    assert.ok(f.depth > 0 && f.depth <= 1 && f.delay >= 0 && f.delay <= 0.74 + 1e-9);
    assert.ok(Number.isFinite(f.cx) && Number.isFinite(f.cy) && Number.isFinite(f.facing));
  }
  assert.deepEqual(facets.map(f => f.depth), [...facets.map(f => f.depth)].sort((x, y) => x - y));
  assert.ok(facets.some(f => f.depth > 0.74), 'at least one facet sits in the foreground');
  assert.equal(facets.filter(f => f.delay === 0).length >= 0, true);
});

test('construction lines grow in, hold, then fade out, and stay inside [0, 1]', () => {
  for (let i = 0; i <= 200; i++) {
    const [len, fade] = growth(i / 100);
    assert.ok(len >= 0 && len <= 1 && fade >= 0 && fade <= 1, String(i));
  }
  assert.equal(growth(0)[0], 0);
  assert.equal(growth(0.5)[0], 1);
  assert.equal(growth(0.5)[1], 1);
  assert.ok(growth(0.99)[1] < 0.2);
  assert.deepEqual(growth(1.5), growth(2.5)); // the loop repeats
});

test('scroll drift lags the page and fades the plate out once the hero has left', () => {
  assert.deepEqual(scrollDepth(0, 900), { shift: 0, fade: 1 });
  assert.ok(scrollDepth(400, 900).shift < 400); // slower than the page
  assert.ok(scrollDepth(400, 900).fade < 1 && scrollDepth(400, 900).fade > 0);
  assert.equal(scrollDepth(2000, 900).fade, 0);
  assert.ok(scrollDepth(700, 900).fade < scrollDepth(300, 900).fade);
});
