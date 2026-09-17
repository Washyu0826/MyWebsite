import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { listPosts } from '@/lib/db/posts';
import { pageMetadata } from '@/lib/metadata';
import { ArticleList } from '@/components/article-list';
import { Container } from '@/components/container';

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ tag?: string | string[] }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Articles' });
  return pageMetadata(locale, '/articles', t('title'), t('description'));
}

export default async function Articles({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { tag: rawTag } = await searchParams;
  const tag = typeof rawTag === 'string' ? rawTag : undefined;
  const [all, posts, t] = await Promise.all([
    listPosts({ limit: 50 }),
    listPosts({ tag, limit: 50 }),
    getTranslations('Articles'),
  ]);
  const tags = Array.from(new Set(all.flatMap(post => post.tags)));

  return <Container className="page">
    <header className="page-heading">
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
    </header>
    <nav className="filter-list" aria-label={t('filter')}>
      <Link href="/articles" className="filter-link" aria-current={!tag ? 'true' : undefined}>
        {t('all')}<span>{all.length}</span>
      </Link>
      {tags.map(category => <Link key={category} href={{ pathname: '/articles', query: { tag: category } }}
        className="filter-link" aria-current={tag === category ? 'true' : undefined}>
        {category}<span>{all.filter(post => post.tags.includes(category)).length}</span>
      </Link>)}
    </nav>
    {posts.length ? <ArticleList posts={posts} locale={locale} /> : <div className="border-t border-rule py-10">
      <p>{t('empty')}</p>
      <Link className="text-link" href="/articles">{t('clear')}</Link>
    </div>}
  </Container>;
}
