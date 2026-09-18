import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyHref } from '../src/lib/urls';
import { CONTACT_LIMITS, validateContact } from '../src/lib/contact/validate';
import { contactHref, describeSocialLink } from '../src/lib/contact-links';

test('markdown links: absolute http(s) open externally, site paths lose their locale prefix, anchors stay', () => {
  assert.deepEqual(classifyHref('https://example.com/a?b=1'), { kind: 'external', href: 'https://example.com/a?b=1' });
  assert.deepEqual(classifyHref('http://example.com'), { kind: 'external', href: 'http://example.com/' });
  assert.deepEqual(classifyHref('/projects/demo'), { kind: 'internal', href: '/projects/demo' });
  assert.deepEqual(classifyHref('/zh/projects/demo'), { kind: 'internal', href: '/projects/demo' });
  assert.deepEqual(classifyHref('/en'), { kind: 'internal', href: '/' });
  assert.deepEqual(classifyHref('/en?tag=web'), { kind: 'internal', href: '/?tag=web' });
  assert.deepEqual(classifyHref('/english/page'), { kind: 'internal', href: '/english/page' });
  assert.deepEqual(classifyHref('#section'), { kind: 'anchor', href: '#section' });
});

test('markdown links: protocol-relative, mailto, tel, javascript and data URLs are rejected', () => {
  for (const value of ['//evil.example', 'mailto:a@b.c', 'tel:+886', 'javascript:alert(1)', 'data:text/html,x', 'relative/path', '', undefined, null]) {
    assert.deepEqual(classifyHref(value), { kind: 'rejected' }, String(value));
  }
});

const now = 1_700_000_000_000;
const valid = { name: 'Ada', email: 'ada@example.com', subject: '', message: 'Hello, I would like to talk.', locale: 'en', website: '', startedAt: String(now - 10_000) };

test('contact validation accepts a well-formed submission and normalises whitespace and locale', () => {
  const result = validateContact({ ...valid, name: '  Ada  ', locale: 'fr', subject: '  Hi ' }, now);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.data, { name: 'Ada', email: 'ada@example.com', subject: 'Hi', message: valid.message, locale: 'zh' });
});

test('contact validation reports every invalid field', () => {
  const result = validateContact({ ...valid, name: 'x'.repeat(CONTACT_LIMITS.name + 1), email: 'not-an-email', message: 'short' }, now);
  assert.deepEqual(result, { ok: false, reason: 'invalid', fields: ['name', 'email', 'message'] });
  const tooLong = validateContact({ ...valid, message: 'x'.repeat(CONTACT_LIMITS.message.max + 1) }, now);
  assert.deepEqual(tooLong, { ok: false, reason: 'invalid', fields: ['message'] });
  assert.deepEqual(validateContact({ ...valid, name: '' }, now), { ok: false, reason: 'invalid', fields: ['name'] });
});

test('contact validation treats a filled honeypot or a too-fast submission as spam', () => {
  assert.deepEqual(validateContact({ ...valid, website: 'http://spam' }, now), { ok: false, reason: 'spam' });
  assert.deepEqual(validateContact({ ...valid, startedAt: String(now - 1_000) }, now), { ok: false, reason: 'spam' });
  assert.deepEqual(validateContact({ ...valid, startedAt: '' }, now), { ok: false, reason: 'spam' });
  assert.deepEqual(validateContact({ ...valid, startedAt: 'abc' }, now), { ok: false, reason: 'spam' });
  assert.equal(validateContact({ ...valid, startedAt: String(now - CONTACT_LIMITS.minSeconds * 1000) }, now).ok, true);
});

test('contact links: tel, mailto, LINE and Instagram rows resolve to href, display and copy values', () => {
  assert.equal(contactHref('tel:+886 0961-160-826'), 'tel:+8860961160826');
  assert.equal(contactHref('tel:abc'), null);
  assert.equal(contactHref('mailto:me@example.com'), 'mailto:me%40example.com');
  assert.equal(contactHref('javascript:alert(1)'), null);
  const phone = describeSocialLink({ id: '1', platform: 'phone', label: '', url: 'tel:+886 0961160826' });
  assert.deepEqual(phone, { key: '1', kind: 'phone', label: '', href: 'tel:+8860961160826', display: '+886 0961160826', copyValue: '+886 0961160826' });
  const line = describeSocialLink({ id: '2', platform: 'line', label: 'LINE', url: 'https://line.me/ti/p/~zenobia0826' });
  assert.equal(line?.kind, 'line'); assert.equal(line?.display, 'zenobia0826'); assert.equal(line?.copyValue, 'zenobia0826');
  const ig = describeSocialLink({ id: '3', platform: '', label: '', url: 'https://www.instagram.com/ryan.hsien_ky0826/' });
  assert.equal(ig?.kind, 'instagram'); assert.equal(ig?.display, 'ryan.hsien_ky0826');
  const github = describeSocialLink({ id: '4', platform: 'github', label: 'GitHub', url: 'https://github.com/someone' });
  assert.equal(github?.display, 'github.com/someone'); assert.equal(github?.copyValue, 'https://github.com/someone');
  assert.equal(describeSocialLink({ id: '5', platform: 'x', label: '', url: 'ftp://nope' }), null);
});
