import assert from 'node:assert/strict';
import test from 'node:test';
import { collapseUnchanged, diffLines, diffSnapshots, snapshotText } from '../src/lib/diff';

const shape = (before: string, after: string) => diffLines(before, after).map(row => `${row.type[0]}${row.text}`);

test('identical text produces no changes and keeps both line numbers', () => {
  const rows = diffLines('a\nb', 'a\nb');
  assert.deepEqual(rows.map(row => row.type), ['same', 'same']);
  assert.deepEqual(rows.map(row => [row.before, row.after]), [[1, 1], [2, 2]]);
});

test('an inserted line is an addition, not a rewrite of everything after it', () => {
  assert.deepEqual(shape('a\nc', 'a\nb\nc'), ['sa', 'ab', 'sc']);
});

test('a deleted line is a removal', () => {
  assert.deepEqual(shape('a\nb\nc', 'a\nc'), ['sa', 'rb', 'sc']);
});

test('a changed line reads as a removal followed by an addition', () => {
  assert.deepEqual(shape('a\nb\nc', 'a\nB\nc'), ['sa', 'rb', 'aB', 'sc']);
});

test('empty sides are handled without inventing a blank line', () => {
  assert.deepEqual(diffLines('', ''), []);
  assert.deepEqual(shape('', 'a'), ['aa']);
  assert.deepEqual(shape('a', ''), ['ra']);
});

test('line numbers count each side separately', () => {
  const rows = diffLines('keep\ndrop\ntail', 'keep\nadd\nmore\ntail');
  const removed = rows.find(row => row.type === 'removed');
  const added = rows.find(row => row.type === 'added');
  assert.deepEqual([removed?.before, removed?.after], [2, null]);
  assert.deepEqual([added?.before, added?.after], [null, 2]);
  assert.deepEqual(rows.filter(row => row.type === 'same').map(row => [row.before, row.after]), [[1, 1], [3, 4]]);
});

test('CRLF input does not turn every line into a change', () => {
  assert.equal(diffLines('a\r\nb', 'a\nb').every(row => row.type === 'same'), true);
});

test('texts beyond the line budget fall back to a full replacement instead of a huge table', () => {
  const big = Array.from({ length: 12 }, (_, i) => `line ${i}`).join('\n');
  const rows = diffLines(big, `${big}\nextra`, 5);
  assert.equal(rows.filter(row => row.type === 'same').length, 0);
  assert.equal(rows.filter(row => row.type === 'removed').length, 12);
  assert.equal(rows.filter(row => row.type === 'added').length, 13);
});

test('collapseUnchanged keeps context around each change and counts what it hid', () => {
  const rows = diffLines(
    ['1', '2', '3', '4', '5', '6', '7', '8', '9'].join('\n'),
    ['1', '2', '3', '4', 'five', '6', '7', '8', '9'].join('\n'),
  );
  const collapsed = collapseUnchanged(rows, 1);
  assert.deepEqual(collapsed.map(row => (row.type === 'skipped' ? `skip${row.count}` : `${row.type[0]}${row.text}`)),
    ['skip3', 's4', 'r5', 'afive', 's6', 'skip3']);
});

test('collapseUnchanged leaves an all-unchanged diff as one skipped run', () => {
  assert.deepEqual(collapseUnchanged(diffLines('a\nb\nc', 'a\nb\nc'), 2), [{ type: 'skipped', count: 3 }]);
});

test('snapshotText renders arrays, numbers and absent values consistently', () => {
  assert.equal(snapshotText(['a', 'b']), 'a, b');
  assert.equal(snapshotText(7), '7');
  assert.equal(snapshotText(null), '');
  assert.equal(snapshotText(undefined), '');
  assert.equal(snapshotText([]), '');
});

test('diffSnapshots reports only the fields that differ, in reading order', () => {
  const before = { title_zh: '舊標題', body_zh: 'one\ntwo', tags: ['a'], reading_minutes: 3, status: 'draft' };
  const after = { title_zh: '新標題', body_zh: 'one\ntwo', tags: ['a', 'b'], reading_minutes: 3, status: 'draft' };
  const diffs = diffSnapshots(before, after);
  assert.deepEqual(diffs.map(diff => diff.field), ['title_zh', 'tags']);
  assert.deepEqual(diffs.map(diff => diff.label), ['標題（中文）', '標籤']);
  assert.deepEqual([diffs[0].added, diffs[0].removed], [1, 1]);
  assert.equal(diffs[1].after, 'a, b');
});

test('diffSnapshots treats a missing field and an empty one as the same', () => {
  assert.deepEqual(diffSnapshots({ excerpt_en: '' }, {}), []);
  assert.deepEqual(diffSnapshots({ cover_url: null }, { cover_url: '' }), []);
});

test('diffSnapshots ignores keys that are not editable article fields', () => {
  assert.deepEqual(diffSnapshots({ id: 'a', updated_at: '1' }, { id: 'b', updated_at: '2' }), []);
});
