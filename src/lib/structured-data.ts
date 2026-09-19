// JSON-LD builders. Kept free of server-only imports so they can be unit-tested directly;
// whether anything is emitted at all is decided by <JsonLd> (nothing in demo mode).
export type JsonLdNode = Record<string, unknown>;
type Maybe = string | null | undefined;

const FALLBACK_ORIGIN = 'http://localhost:3000';
export function siteOrigin(base: Maybe = process.env.NEXT_PUBLIC_SITE_URL) {
  try { return new URL(base || FALLBACK_ORIGIN).origin; }
  catch { return FALLBACK_ORIGIN; }
}
export function absoluteUrl(path: string, base?: Maybe) {
  return new URL(path || '/', siteOrigin(base)).href;
}
// Search engines reject empty strings and nulls more readily than missing keys.
function compact(node: JsonLdNode): JsonLdNode {
  return Object.fromEntries(Object.entries(node).filter(([, value]) =>
    value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0)));
}
function list(values: Maybe[] | undefined) {
  return Array.from(new Set((values ?? []).filter((value): value is string => Boolean(value && value.trim()))));
}
function language(locale: 'zh' | 'en') { return locale === 'zh' ? 'zh-TW' : 'en'; }

export const PERSON_ID = '/#person';

export function personSchema(input: {
  name: string; locale: 'zh' | 'en'; jobTitle?: Maybe; description?: Maybe; email?: Maybe;
  image?: Maybe; sameAs?: Maybe[]; alumniOf?: Maybe[]; base?: Maybe;
}): JsonLdNode {
  return compact({
    '@type': 'Person',
    '@id': absoluteUrl(PERSON_ID, input.base),
    name: input.name,
    url: absoluteUrl(`/${input.locale}`, input.base),
    jobTitle: input.jobTitle ?? undefined,
    description: input.description ?? undefined,
    email: input.email ? `mailto:${input.email}` : undefined,
    image: input.image ? absoluteUrl(input.image, input.base) : undefined,
    sameAs: list(input.sameAs),
    alumniOf: list(input.alumniOf).map(name => ({ '@type': 'CollegeOrUniversity', name })),
    knowsLanguage: ['zh-TW', 'en'],
  });
}

export function blogPostingSchema(input: {
  path: string; headline: string; locale: 'zh' | 'en'; description?: Maybe; image?: Maybe;
  datePublished?: Maybe; dateModified?: Maybe; keywords?: Maybe[]; authorName: string;
  readingMinutes?: number | null; base?: Maybe;
}): JsonLdNode {
  const url = absoluteUrl(input.path, input.base);
  return compact({
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    headline: input.headline.slice(0, 110),
    description: input.description ?? undefined,
    image: input.image ? absoluteUrl(input.image, input.base) : undefined,
    datePublished: input.datePublished ?? undefined,
    dateModified: input.dateModified || input.datePublished || undefined,
    keywords: list(input.keywords),
    inLanguage: language(input.locale),
    timeRequired: input.readingMinutes ? `PT${Math.round(input.readingMinutes)}M` : undefined,
    author: { '@type': 'Person', '@id': absoluteUrl(PERSON_ID, input.base), name: input.authorName },
    publisher: { '@type': 'Person', '@id': absoluteUrl(PERSON_ID, input.base), name: input.authorName },
  });
}

export function creativeWorkSchema(input: {
  path: string; name: string; locale: 'zh' | 'en'; description?: Maybe; image?: Maybe;
  datePublished?: Maybe; dateModified?: Maybe; keywords?: Maybe[]; authorName: string;
  startDate?: Maybe; endDate?: Maybe; sameAs?: Maybe[]; base?: Maybe;
}): JsonLdNode {
  const url = absoluteUrl(input.path, input.base);
  return compact({
    '@type': 'CreativeWork',
    '@id': `${url}#work`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    name: input.name,
    description: input.description ?? undefined,
    image: input.image ? absoluteUrl(input.image, input.base) : undefined,
    datePublished: input.datePublished ?? undefined,
    dateModified: input.dateModified || input.datePublished || undefined,
    temporalCoverage: input.startDate ? `${input.startDate}/${input.endDate || '..'}` : undefined,
    keywords: list(input.keywords),
    inLanguage: language(input.locale),
    sameAs: list(input.sameAs),
    creator: { '@type': 'Person', '@id': absoluteUrl(PERSON_ID, input.base), name: input.authorName },
  });
}

export function breadcrumbSchema(items: { name: string; path: string }[], base?: Maybe): JsonLdNode | null {
  const usable = items.filter(item => item.name.trim());
  if (usable.length < 2) return null;
  return {
    '@type': 'BreadcrumbList',
    itemListElement: usable.map((item, index) => ({
      '@type': 'ListItem', position: index + 1, name: item.name, item: absoluteUrl(item.path, base),
    })),
  };
}

export function graph(nodes: (JsonLdNode | null | undefined)[]) {
  const usable = nodes.filter((node): node is JsonLdNode => Boolean(node));
  return usable.length ? { '@context': 'https://schema.org', '@graph': usable } : null;
}
