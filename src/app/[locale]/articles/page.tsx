import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { countPosts, listPosts, listPostTags } from '@/lib/db/posts';
import { pageMetadata } from '@/lib/metadata';
import { ArticleList } from '@/components/article-list';
import { Container } from '@/components/container';

const PAGE_SIZE = 12;

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ tag?: string | string[]; page?: string | string[] }>;
};

function parsePage(value: string | string[] | undefined) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return 1;
  return Math.max(1, Number(value));
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Articles' });
  return pageMetadata(locale, '/articles', t('title'), t('description'));
}

export default async function Articles({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { tag: rawTag, page: rawPage } = await searchParams;
  const tag = typeof rawTag === 'string' && rawTag ? rawTag : undefined;
  const page = parsePage(rawPage);
  const [tags, totalAll, totalTagged, posts, t] = await Promise.all([
    listPostTags(),
    countPosts(),
    tag ? countPosts({ tag }) : undefined,
    listPosts({ tag, page, limit: PAGE_SIZE }),
    getTranslations('Articles'),
  ]);
  const total = totalTagged ?? totalAll;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (page > totalPages && totalPages > 0) notFound();
  const pageHref = (target: number) => ({ pathname: '/articles' as const, query: { ...(tag ? { tag } : {}), ...(target > 1 ? { page: String(target) } : {}) } });

  return <Container className="page listing-page">
    <div className="listing-backdrop" aria-hidden="true"><span /><span /><span /><span /><span /><span /></div>
    <header className="page-heading">
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
    </header>
    <nav className="filter-list" aria-label={t('filter')}>
      <Link href="/articles" className="filter-link" aria-current={!tag ? 'true' : undefined}>
        {t('all')}<span>{totalAll}</span>
      </Link>
      {tags.map(({ tag: category, count }) => <Link key={category} href={{ pathname: '/articles', query: { tag: category } }}
        className="filter-link" aria-current={tag === category ? 'true' : undefined}>
        {category}<span>{count}</span>
      </Link>)}
    </nav>
    {posts.length ? <ArticleList posts={posts} locale={locale} /> : <div className="border-t border-rule py-10">
      <p>{t('empty')}</p>
      <Link className="text-link" href="/articles">{t('clear')}</Link>
    </div>}
    {totalPages > 1 ? <nav className="pagination" aria-label={t('pagination')}>
      {page > 1 ? <Link className="text-link" href={pageHref(page - 1)} rel="prev">{t('previousPage')}</Link> : <span />}
      <span className="text-meta text-graphite">{t('page', { page })} / {totalPages}</span>
      {page < totalPages ? <Link className="text-link" href={pageHref(page + 1)} rel="next">{t('nextPage')}</Link> : <span />}
    </nav> : null}
  </Container>;
}
