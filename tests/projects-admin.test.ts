import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isPubliclyVisible, parseDateInput, parseInteger, parseList, parseTags, parseUrl, projectTags, slugify,
} from '../src/app/admin/projects/fields';

test('slugify produces lowercase hyphenated slugs and drops quotes', () => {
  assert.equal(slugify('  Document Search Workspace '), 'document-search-workspace');
  assert.equal(slugify("Rob's \"Quick\" Tool!"), 'robs-quick-tool');
  assert.equal(slugify('文件檢索'), '');
  assert.equal(slugify('a'.repeat(120)).length, 96);
});

test('parseList splits on commas and newlines, trims, de-duplicates case-insensitively and caps the count', () => {
  assert.deepEqual(parseList('Next.js, TypeScript,\nPostgreSQL , next.js,,'), ['Next.js', 'TypeScript', 'PostgreSQL']);
  assert.deepEqual(parseList(''), []);
  assert.equal(parseList(Array.from({ length: 40 }, (_, i) => `t${i}`).join(',')).length, 30);
  assert.equal(parseList('x'.repeat(100))[0].length, 60);
});

test('parseTags keeps only known tags in canonical order', () => {
  assert.deepEqual(parseTags(['tool', 'web', 'bogus', 42, 'web']), ['web', 'tool']);
  assert.deepEqual(parseTags([]), []);
  assert.deepEqual(parseTags([...projectTags].reverse()), [...projectTags]);
});

test('parseUrl accepts http(s) and site-relative paths, rejects the rest', () => {
  assert.deepEqual(parseUrl(''), { ok: true, value: null });
  assert.deepEqual(parseUrl('  https://example.com/a b '), { ok: true, value: 'https://example.com/a%20b' });
  assert.deepEqual(parseUrl('http://example.com'), { ok: true, value: 'http://example.com/' });
  assert.deepEqual(parseUrl('/demo/workspace.svg'), { ok: true, value: '/demo/workspace.svg' });
  assert.equal(parseUrl('//evil.example').ok, false);
  assert.equal(parseUrl('javascript:alert(1)').ok, false);
  assert.equal(parseUrl('ftp://example.com/x').ok, false);
  assert.equal(parseUrl('not a url').ok, false);
});

test('parseDateInput validates real calendar dates', () => {
  assert.deepEqual(parseDateInput(''), { ok: true, value: null });
  assert.deepEqual(parseDateInput('2025-03-01'), { ok: true, value: '2025-03-01' });
  assert.deepEqual(parseDateInput('2024-02-29'), { ok: true, value: '2024-02-29' });
  assert.equal(parseDateInput('2025-02-30').ok, false);
  assert.equal(parseDateInput('2025-13-01').ok, false);
  assert.equal(parseDateInput('03/01/2025').ok, false);
  assert.equal(parseDateInput('2025-3-1').ok, false);
});

test('parseInteger enforces integers within bounds and treats empty as null', () => {
  assert.deepEqual(parseInteger(''), { ok: true, value: null });
  assert.deepEqual(parseInteger(' 3 ', { min: 1 }), { ok: true, value: 3 });
  assert.deepEqual(parseInteger('-5'), { ok: true, value: -5 });
  assert.equal(parseInteger('0', { min: 1 }).ok, false);
  assert.equal(parseInteger('2.5').ok, false);
  assert.equal(parseInteger('abc').ok, false);
  assert.equal(parseInteger('1e3').ok, false);
});

test('isPubliclyVisible requires published status and a past published_at', () => {
  const now = Date.parse('2026-09-18T12:00:00Z');
  assert.equal(isPubliclyVisible({ status: 'published', published_at: '2026-09-18T11:00:00Z' }, now), true);
  assert.equal(isPubliclyVisible({ status: 'published', published_at: '2026-09-18T13:00:00Z' }, now), false);
  assert.equal(isPubliclyVisible({ status: 'published', published_at: null }, now), false);
  assert.equal(isPubliclyVisible({ status: 'scheduled', published_at: '2026-09-18T11:00:00Z' }, now), false);
  assert.equal(isPubliclyVisible({ status: 'draft', published_at: '2026-09-18T11:00:00Z' }, now), false);
});
