import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getPostBySlug, listPostSlugs } from '@/lib/db/posts';
import { pickLocale } from '@/lib/locale';
import { pageMetadata } from '@/lib/metadata';
import { Container } from '@/components/container';
import { Markdown } from '@/components/markdown';

type Props = { params: Promise<{ locale: Locale; slug: string }> };

function formatArticleDate(value: string | null, locale: Locale) {
  if (!value) return '';
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-TW' : 'en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

export async function generateStaticParams() {
  return listPostSlugs();
}

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();
  const p = pickLocale(post, locale);
  return pageMetadata(locale, `/articles/${slug}`, p.title, p.excerpt);
}

export default async function ArticleDetail({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const [post, t] = await Promise.all([getPostBySlug(slug), getTranslations('Articles')]);
  if (!post) notFound();
  const p = pickLocale(post, locale);

  return <Container className="page article-page">
    <Link href="/articles" className="text-link mb-8 text-meta">{t('back')}</Link>
    <header className="article-heading">
      <div className="article-meta-line">
        {post.published_at ? <span>{formatArticleDate(post.published_at, locale)}</span> : null}
        {post.reading_minutes ? <span>{post.reading_minutes} min read</span> : null}
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
