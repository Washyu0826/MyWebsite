import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlate, buildSpan, clipLine, mulberry32, PLATE_H, PLATE_W, SPAN_H, SPAN_W } from '../src/lib/facet-plate';
import { splitName } from '../src/lib/format';

const numbers = (d: string) => d.slice(1).replace(/[A-Za-z]/g, ' ').trim().split(/[\s,]+/).map(Number);

test('the plate is deterministic: the server and the client draw the same picture', () => {
  const a = buildPlate(4211);
  const b = buildPlate(4211);
  assert.deepEqual(a, b);
  assert.equal(mulberry32(4211)(), mulberry32(4211)());
  assert.notDeepEqual(buildPlate(4211).facets[0].d, buildPlate(9137).facets[0].d);
});

test('the facets tile the plate: every point is inside it and the areas add up', () => {
  const { facets } = buildPlate(4211);
  assert.equal(facets.length, 17);
  let total = 0;
  for (const facet of facets) {
    const pts = numbers(facet.d);
    assert.ok(pts.length >= 6 && pts.length % 2 === 0, facet.d);
    for (let i = 0; i < pts.length; i += 2) {
      assert.ok(pts[i] >= -0.01 && pts[i] <= PLATE_W + 0.01, `x ${pts[i]}`);
      assert.ok(pts[i + 1] >= -0.01 && pts[i + 1] <= PLATE_H + 0.01, `y ${pts[i + 1]}`);
    }
    let area = 0;
    for (let i = 0; i < pts.length; i += 2) {
      const [x1, y1] = [pts[i], pts[i + 1]];
      const [x2, y2] = [pts[(i + 2) % pts.length], pts[(i + 3) % pts.length]];
      area += x1 * y2 - x2 * y1;
    }
    total += Math.abs(area) / 2;
  }
  // Cutting only ever divides the rectangle, so the pieces cover it exactly and overlap nowhere.
  assert.ok(Math.abs(total - PLATE_W * PLATE_H) < 1, `covered ${total} of ${PLATE_W * PLATE_H}`);
});

test('every facet is paintable and every layer is used', () => {
  const { facets, lines, arcs } = buildPlate(9137);
  for (const facet of facets) {
    assert.ok(facet.pigment >= 0 && facet.pigment <= 5);
    // Weighted towards the top of the plate, and capped there so no single plane ever shouts.
    assert.ok(facet.alpha > 0 && facet.alpha <= 0.3);
    assert.ok(facet.sway >= 16 && facet.sway <= 30);
    assert.ok(facet.lag >= 0 && facet.lag <= 0.7);
  }
  // Sorted back to front, so the near planes paint over the ones behind them.
  assert.deepEqual(
    facets.map(f => f.layer),
    [...facets.map(f => f.layer)].sort((a, b) => a - b),
  );
  for (const layer of [0, 1, 2]) {
    assert.ok(facets.some(f => f.layer === layer), `layer ${layer} is empty`);
  }
  assert.equal(lines.length, 6);
  assert.equal(arcs.length, 4);
  for (const line of lines) assert.ok(line.length > 0 && line.period > 0);
});

test('a construction line is clipped to the plate, and a line that misses it is dropped', () => {
  const span = clipLine(PLATE_W / 2, PLATE_H / 2, 0.6);
  assert.ok(span);
  for (const [x, y] of span) {
    assert.ok(x >= -0.01 && x <= PLATE_W + 0.01);
    assert.ok(y >= -0.01 && y <= PLATE_H + 0.01);
  }
  assert.equal(clipLine(-40, PLATE_H / 2, Math.PI / 2), null);
});

test('a name splits into the one a document carries and the one people use', () => {
  assert.deepEqual(splitName('Kuan-Yu Hsien (Zenobia)'), { name: 'Kuan-Yu Hsien', nickname: 'Zenobia' });
  assert.deepEqual(splitName('冼冠宇（Zenobia）'), { name: '冼冠宇', nickname: 'Zenobia' });
  assert.deepEqual(splitName('  Kuan-Yu Hsien  '), { name: 'Kuan-Yu Hsien', nickname: '' });
  assert.deepEqual(splitName(null), { name: '', nickname: '' });
  // A bracket that is not a trailing alias is left where it is.
  assert.deepEqual(splitName('Hsien (Kuan-Yu) Zenobia'), { name: 'Hsien (Kuan-Yu) Zenobia', nickname: '' });
});

test('what crosses the middle of the page is line work and nothing else', () => {
  const span = buildSpan(2608);
  assert.deepEqual(span, buildSpan(2608));
  assert.equal(span.lines.length, 7);
  assert.equal(span.arcs.length, 3);
  // Every line reaches both edges of the box and stays inside it: a filled plane would put a tint
  // behind a column of text, which is the one thing this layer must never do.
  for (const line of span.lines) {
    const pts = numbers(line.d);
    assert.equal(pts.length, 4);
    for (let i = 0; i < 4; i += 2) {
      assert.ok(pts[i] >= -0.01 && pts[i] <= SPAN_W + 0.01, `x ${pts[i]}`);
      assert.ok(pts[i + 1] >= -0.01 && pts[i + 1] <= SPAN_H + 0.01, `y ${pts[i + 1]}`);
    }
    assert.ok(line.length > SPAN_H * 0.3);
    // Nothing on this layer is animated, so it carries no clock.
    assert.equal(line.period, 0);
    assert.equal(line.lag, 0);
  }
  for (const arc of span.arcs) assert.ok(arc.d.includes('A') && arc.alpha > 0 && arc.alpha <= 0.9);
});
