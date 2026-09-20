import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getPostBySlug, listPostSlugs } from '@/lib/db/posts';
import { getProfile } from '@/lib/db/profile';
import { pickLocale } from '@/lib/locale';
import { isoDate, longDayLabel } from '@/lib/format';
import { pageMetadata } from '@/lib/metadata';
import { blogPostingSchema, breadcrumbSchema } from '@/lib/structured-data';
import { Container } from '@/components/container';
import { Markdown } from '@/components/markdown';
import { JsonLd } from '@/components/json-ld';
import { ReadingProgress } from '@/components/reading-progress';
import { PwaRegister } from '@/app/offline/pwa-register';

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateStaticParams() {
  try {
    return await listPostSlugs();
  } catch (error) {
    console.warn('Skipping article static params during build:', error);
    return [];
  }
}

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();
  const p = pickLocale(post, locale);
  return pageMetadata(locale, `/articles/${slug}`, p.title, p.excerpt, post.cover_url);
}

export default async function ArticleDetail({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const [post, profile, t, site] = await Promise.all([getPostBySlug(slug), getProfile(), getTranslations('Articles'), getTranslations('Site')]);
  if (!post) notFound();
  const p = pickLocale(post, locale);
  const path = `/${locale}/articles/${slug}`;
  const article = blogPostingSchema({
    path, headline: p.title, locale, description: p.excerpt, image: post.cover_url,
    datePublished: isoDate(post.published_at), dateModified: isoDate(post.updated_at),
    keywords: post.tags, readingMinutes: post.reading_minutes, authorName: pickLocale(profile, locale).name,
  });
  const crumbs = breadcrumbSchema([
    { name: site('brand'), path: `/${locale}` },
    { name: t('title'), path: `/${locale}/articles` },
    { name: p.title, path },
  ]);

  return <Container className="page article-page">
    <JsonLd nodes={[article, crumbs]} />
    <PwaRegister />
    <ReadingProgress target=".article-body" />
    <Link href="/articles" className="text-link mb-8 text-meta" data-print="hide">{t('back')}</Link>
    <header className="article-heading">
      <div className="article-meta-line">
        {post.published_at ? <time dateTime={isoDate(post.published_at)}>{longDayLabel(post.published_at, locale)}</time> : null}
        {post.reading_minutes ? <span>{t('readingTime', { minutes: post.reading_minutes })}</span> : null}
      </div>
      <h1>{p.title}</h1>
      {p.excerpt ? <p>{p.excerpt}</p> : null}
      {post.tags.length ? <ul className="article-tags" aria-label={t('tags')}>
        {post.tags.map(tag => <li key={tag}>{tag}</li>)}
      </ul> : null}
    </header>
    {post.cover_url ? <Image src={post.cover_url} alt={p.cover_alt || p.title} width={1200} height={675}
      priority sizes="(max-width: 767px) calc(100vw - 40px), 984px" className="article-cover" /> : null}
    <article className="article-body">
      <Markdown>{p.body || ''}</Markdown>
    </article>
  </Container>;
}
