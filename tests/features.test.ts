import assert from 'node:assert/strict';
import test from 'node:test';
import { contactDraftSchema, contactSchema, isContactFieldValid, CONTACT_LIMITS } from '../src/lib/schema';
import { dayLabel, isoDate, longDayLabel, monthLabel, monthRangeLabel, numberLabel, publishedLabel, relativeLabel } from '../src/lib/format';
import { absoluteUrl, blogPostingSchema, breadcrumbSchema, creativeWorkSchema, graph, personSchema, siteOrigin } from '../src/lib/structured-data';

const BASE = 'https://hsien.dev';
const NOW = Date.parse('2026-09-20T00:00:00Z');

test('contact schema is the single source of truth the client validates fields against', () => {
  assert.equal(isContactFieldValid('name', '  Ada  '), true);
  assert.equal(isContactFieldValid('name', '   '), false);
  assert.equal(isContactFieldValid('name', 'x'.repeat(CONTACT_LIMITS.name + 1)), false);
  assert.equal(isContactFieldValid('email', 'ada@example.com'), true);
  assert.equal(isContactFieldValid('email', 'ada@example'), false);
  assert.equal(isContactFieldValid('message', 'x'.repeat(CONTACT_LIMITS.message.min - 1)), false);
  assert.equal(isContactFieldValid('message', 'x'.repeat(CONTACT_LIMITS.message.min)), true);
  // Non-string FormData entries (a File) count as empty rather than crashing the parse.
  assert.equal(contactSchema.safeParse({ name: {}, email: 1, message: null }).success, false);
  const parsed = contactSchema.parse({ name: ' Ada ', email: 'ada@example.com', message: 'Hello there, friend.', subject: 'x'.repeat(300), locale: 'fr' });
  assert.equal(parsed.subject.length, CONTACT_LIMITS.subject);
  assert.equal(parsed.locale, 'zh');
});

test('contact draft schema drops anything that is not a usable saved draft', () => {
  assert.deepEqual(contactDraftSchema.parse({ name: 'Ada', extra: 'ignored' }), { name: 'Ada' });
  assert.deepEqual(contactDraftSchema.parse({ name: 42 }), { name: '' });
  assert.equal(contactDraftSchema.safeParse('not-an-object').success, false);
});

test('dates render in the reader language: 2026 年 9 月 in Chinese, Sep 2026 in English', () => {
  assert.equal(monthLabel('2026-09-01', 'zh'), '2026 年 9 月');
  assert.equal(monthLabel('2026-09-01', 'en'), 'Sep 2026');
  assert.equal(dayLabel('2026-09-01', 'zh'), '2026 年 9 月 1 日');
  assert.equal(dayLabel('2026-09-01', 'en'), 'Sep 1, 2026');
  assert.equal(longDayLabel('2026-09-01', 'en'), 'September 1, 2026');
  // A UTC timestamp must not slide into the previous month for readers west of UTC.
  assert.equal(monthLabel('2026-09-01T00:00:00Z', 'en'), 'Sep 2026');
  assert.equal(monthLabel('', 'zh'), '');
  assert.equal(dayLabel('not-a-date', 'en'), '');
});

test('year ranges close with the present label when the end date is missing', () => {
  assert.equal(monthRangeLabel('2025-03-01', '2025-06-01', 'zh'), '2025 年 3 月 – 2025 年 6 月');
  assert.equal(monthRangeLabel('2023-09-01', null, 'en', 'Present'), 'Sep 2023 – Present');
  assert.equal(monthRangeLabel('2023-09-01', null, 'en'), 'Sep 2023');
  assert.equal(monthRangeLabel(null, '2025-06-01', 'en'), '');
});

test('recent dates read as relative time, older ones fall back to the date', () => {
  assert.equal(relativeLabel('2026-09-17', 'zh', NOW), '3 天前');
  assert.equal(relativeLabel('2026-09-17', 'en', NOW), '3 days ago');
  assert.equal(publishedLabel('2026-09-17T00:00:00Z', 'en', NOW), '3 days ago');
  assert.equal(publishedLabel('2025-01-05', 'zh', NOW), '2025 年 1 月 5 日');
  assert.equal(publishedLabel(null, 'zh', NOW), '');
  assert.equal(numberLabel(12345.67, 'en', { maximumFractionDigits: 1 }), '12,345.7');
  assert.equal(numberLabel(Number.NaN, 'en'), '');
  assert.equal(isoDate('2026-09-01'), '2026-09-01T00:00:00.000Z');
  assert.equal(isoDate(null), '');
});

test('structured data resolves against the real site URL and drops empty values', () => {
  assert.equal(siteOrigin(BASE), 'https://hsien.dev');
  assert.equal(siteOrigin('not a url'), 'http://localhost:3000');
  assert.equal(absoluteUrl('/zh/articles/x', BASE), 'https://hsien.dev/zh/articles/x');
  const person = personSchema({
    name: 'Kuan-Yu Hsien', locale: 'en', jobTitle: 'Software Engineer', description: '', email: 'hi@example.com',
    image: '/portrait.png', sameAs: ['https://github.com/x', null, '  ', 'https://github.com/x'], alumniOf: ['Computer Science'], base: BASE,
  });
  assert.equal(person['@type'], 'Person');
  assert.equal(person['@id'], 'https://hsien.dev/#person');
  assert.equal(person.url, 'https://hsien.dev/en');
  assert.equal(person.email, 'mailto:hi@example.com');
  assert.equal(person.image, 'https://hsien.dev/portrait.png');
  assert.deepEqual(person.sameAs, ['https://github.com/x']);
  assert.deepEqual(person.alumniOf, [{ '@type': 'CollegeOrUniversity', name: 'Computer Science' }]);
  assert.equal('description' in person, false);
});

test('article and project pages describe themselves as BlogPosting and CreativeWork', () => {
  const post = blogPostingSchema({
    path: '/en/articles/hello', headline: 'Hello', locale: 'en', description: 'An intro', image: '/cover.png',
    datePublished: '2026-09-01T00:00:00.000Z', dateModified: '', keywords: ['web', 'web'], readingMinutes: 7, authorName: 'Kuan-Yu Hsien', base: BASE,
  });
  assert.equal(post['@type'], 'BlogPosting');
  assert.equal(post.url, 'https://hsien.dev/en/articles/hello');
  assert.equal(post.dateModified, '2026-09-01T00:00:00.000Z');
  assert.equal(post.timeRequired, 'PT7M');
  assert.deepEqual(post.keywords, ['web']);
  assert.equal(post.inLanguage, 'en');
  assert.deepEqual(post.author, { '@type': 'Person', '@id': 'https://hsien.dev/#person', name: 'Kuan-Yu Hsien' });

  const work = creativeWorkSchema({
    path: '/zh/projects/demo', name: '示範專案', locale: 'zh', description: '摘要', datePublished: '2026-09-01T00:00:00.000Z',
    startDate: '2025-03-01', endDate: null, keywords: ['tool'], sameAs: [null], authorName: '冼冠宇', base: BASE,
  });
  assert.equal(work['@type'], 'CreativeWork');
  assert.equal(work.inLanguage, 'zh-TW');
  assert.equal(work.temporalCoverage, '2025-03-01/..');
  assert.equal('sameAs' in work, false);
});

test('breadcrumbs need at least two steps and number themselves from one', () => {
  assert.equal(breadcrumbSchema([{ name: 'Home', path: '/en' }], BASE), null);
  const crumbs = breadcrumbSchema([{ name: 'Home', path: '/en' }, { name: 'Notes', path: '/en/articles' }], BASE);
  assert.deepEqual(crumbs?.itemListElement, [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://hsien.dev/en' },
    { '@type': 'ListItem', position: 2, name: 'Notes', item: 'https://hsien.dev/en/articles' },
  ]);
});

test('the rendered graph is valid JSON-LD and collapses to nothing when empty', () => {
  assert.equal(graph([null, undefined]), null);
  const data = graph([personSchema({ name: 'A', locale: 'zh', base: BASE }), breadcrumbSchema([{ name: 'A', path: '/zh' }, { name: 'B', path: '/zh/b' }], BASE)]);
  const parsed = JSON.parse(JSON.stringify(data)) as { '@context': string; '@graph': Record<string, unknown>[] };
  assert.equal(parsed['@context'], 'https://schema.org');
  assert.deepEqual(parsed['@graph'].map(node => node['@type']), ['Person', 'BreadcrumbList']);
  for (const node of parsed['@graph']) assert.ok(typeof node['@type'] === 'string' && node['@type'].length > 0);
});
