import { getTranslations } from 'next-intl/server';
import type { Post } from '@/types/content';
import type { Locale } from '@/i18n/routing';
import { Link } from '@/i18n/navigation';
import { pickLocale } from '@/lib/locale';
import { isoDate, publishedLabel } from '@/lib/format';
import { CoverPreview } from './cover-preview';

export async function ArticleList({ posts, locale }: { posts: Post[]; locale: Locale }) {
  const t = await getTranslations('Articles');
  return <CoverPreview className="article-list">
    {posts.map(post => {
      const p = pickLocale(post, locale);
      return <Link href={`/articles/${post.slug}`} className="article-row" key={post.id}
        data-cover-src={post.cover_url || undefined} data-cover-alt={p.cover_alt || p.title}>
        <div className="article-row-meta">
          <time dateTime={isoDate(post.published_at)}>{publishedLabel(post.published_at, locale)}</time>
          {post.reading_minutes ? <span>{t('readingTime', { minutes: post.reading_minutes })}</span> : null}
        </div>
        <div className="article-row-body">
          <h2>{p.title}</h2>
          {p.excerpt ? <p>{p.excerpt}</p> : null}
          {post.tags.length ? <ul className="article-tags" aria-label={t('tags')}>
            {post.tags.map(tag => <li key={tag}>{tag}</li>)}
          </ul> : null}
        </div>
      </Link>;
    })}
  </CoverPreview>;
}
