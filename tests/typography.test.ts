import assert from 'node:assert/strict';
import test from 'node:test';
import { hasHan, pangu, truncateVisual, visualWidth } from '../src/lib/typography';

test('pangu spaces Han against Latin and numerals in both directions', () => {
  assert.equal(pangu('我用Next.js做了一個網站'), '我用 Next.js 做了一個網站');
  assert.equal(pangu('2027年畢業'), '2027 年畢業');
  assert.equal(pangu('版本v2的變更'), '版本 v2 的變更');
  assert.equal(pangu('看(note)說明'), '看 (note) 說明');
});
test('pangu leaves existing spacing, pure Latin and fullwidth punctuation alone', () => {
  assert.equal(pangu('我用 Next.js 做了一個網站'), '我用 Next.js 做了一個網站');
  assert.equal(pangu('Looking for 2027 new-grad roles'), 'Looking for 2027 new-grad roles');
  // 。「」 carry their own half-em; a space beside them would open a hole, not close one.
  assert.equal(pangu('意圖最重要。動手執行之前，我會先弄清楚。'), '意圖最重要。動手執行之前，我會先弄清楚。');
});
test('pangu is idempotent so it can run on already-processed strings', () => {
  const once = pangu('用React寫的3個專案');
  assert.equal(pangu(once), once);
  assert.equal(once, '用 React 寫的 3 個專案');
});
test('hasHan distinguishes Han-bearing strings from Latin-only ones', () => {
  assert.equal(hasHan('冼冠宇'), true);
  assert.equal(hasHan('Kuan-Yu Hsien'), false);
  assert.equal(hasHan('CS undergrad · 求職中'), true);
});
test('visualWidth counts fullwidth glyphs as two columns', () => {
  assert.equal(visualWidth('abc'), 3);
  assert.equal(visualWidth('關於'), 4);
  assert.equal(visualWidth('AI 工程'), 3 + 4);
  assert.equal(visualWidth('（）'), 4);
});
test('truncateVisual respects the column budget and never splits the ellipsis off', () => {
  assert.equal(truncateVisual('short', 10), 'short');
  assert.equal(truncateVisual('我是一個前端工程師', 8), '我是一…');
  assert.equal(visualWidth(truncateVisual('我是一個前端工程師', 8)) <= 8, true);
  assert.equal(truncateVisual('abcdefghij', 5), 'abcd…');
  assert.equal(truncateVisual('中', 1), '…');
  assert.equal(truncateVisual('anything', 0), '');
});
