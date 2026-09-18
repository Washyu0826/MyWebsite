import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cleanText, experienceKindLabels, experienceKinds, isExperienceKind, isValidEmail, isValidHttpUrl,
  isValidSocialUrl, normalizeDate, normalizePlatform, parseSortOrder, tooLong, uuidPattern,
} from '../src/app/admin/profile/validation';

test('cleanText trims form values and treats null as empty', () => {
  assert.equal(cleanText('  hello  '), 'hello');
  assert.equal(cleanText(null), '');
  assert.equal(cleanText(undefined), '');
});

test('isValidEmail accepts ordinary addresses and rejects malformed ones', () => {
  assert.equal(isValidEmail('me@example.com'), true);
  assert.equal(isValidEmail('first.last+tag@sub.example.co'), true);
  assert.equal(isValidEmail('not-an-email'), false);
  assert.equal(isValidEmail('missing@tld'), false);
  assert.equal(isValidEmail('two words@example.com'), false);
  assert.equal(isValidEmail(''), false);
  assert.equal(isValidEmail(`${'a'.repeat(250)}@example.com`), false);
});

test('isValidHttpUrl only accepts absolute http(s) URLs', () => {
  assert.equal(isValidHttpUrl('https://github.com/handle'), true);
  assert.equal(isValidHttpUrl('http://localhost:3000'), true);
  assert.equal(isValidHttpUrl('ftp://example.com'), false);
  assert.equal(isValidHttpUrl('javascript:alert(1)'), false);
  assert.equal(isValidHttpUrl('github.com/handle'), false);
  assert.equal(isValidHttpUrl(''), false);
});

test('isValidSocialUrl also accepts mailto: addresses', () => {
  assert.equal(isValidSocialUrl('mailto:me@example.com'), true);
  assert.equal(isValidSocialUrl('MAILTO:me@example.com'), true);
  assert.equal(isValidSocialUrl('mailto:'), false);
  assert.equal(isValidSocialUrl('mailto:not-an-email'), false);
  assert.equal(isValidSocialUrl('https://www.linkedin.com/in/handle'), true);
  assert.equal(isValidSocialUrl('data:text/html,hi'), false);
});

test('experience kinds match the database enum and have Chinese labels', () => {
  assert.deepEqual([...experienceKinds], ['work', 'education', 'award', 'activity']);
  for (const kind of experienceKinds) {
    assert.equal(isExperienceKind(kind), true);
    assert.ok(experienceKindLabels[kind]);
  }
  assert.equal(isExperienceKind('hobby'), false);
  assert.equal(isExperienceKind(''), false);
});

test('normalizeDate validates real YYYY-MM-DD calendar dates', () => {
  assert.equal(normalizeDate('2026-09-18'), '2026-09-18');
  assert.equal(normalizeDate('2024-02-29'), '2024-02-29');
  assert.equal(normalizeDate('2023-02-29'), null);
  assert.equal(normalizeDate('2026-13-01'), null);
  assert.equal(normalizeDate('2026-00-10'), null);
  assert.equal(normalizeDate('2026-9-1'), null);
  assert.equal(normalizeDate('18/09/2026'), null);
  assert.equal(normalizeDate(''), null);
});

test('parseSortOrder falls back to the default and clamps to a sane range', () => {
  assert.equal(parseSortOrder(''), 0);
  assert.equal(parseSortOrder('', 5), 5);
  assert.equal(parseSortOrder('abc'), 0);
  assert.equal(parseSortOrder('3.9'), 3);
  assert.equal(parseSortOrder('-2'), -2);
  assert.equal(parseSortOrder('99999'), 9999);
  assert.equal(parseSortOrder('-99999'), -9999);
});

test('normalizePlatform lowercases and slugs the platform key', () => {
  assert.equal(normalizePlatform('GitHub'), 'github');
  assert.equal(normalizePlatform('  Linked In '), 'linked-in');
  assert.equal(normalizePlatform('x'), 'x');
  assert.equal(normalizePlatform('!!!'), '');
  assert.equal(normalizePlatform('a'.repeat(60)).length, 40);
});

test('tooLong and uuidPattern behave as expected', () => {
  assert.equal(tooLong('abc', 3), false);
  assert.equal(tooLong('abcd', 3), true);
  assert.equal(uuidPattern.test('123e4567-e89b-42d3-a456-426614174000'), true);
  assert.equal(uuidPattern.test('not-a-uuid'), false);
  assert.equal(uuidPattern.test(''), false);
});
