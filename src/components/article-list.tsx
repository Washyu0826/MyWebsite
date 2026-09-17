import type { Post } from '@/types/content';
import type { Locale } from '@/i18n/routing';
import { Link } from '@/i18n/navigation';
import { pickLocale } from '@/lib/locale';

function formatArticleDate(value: string | null, locale: Locale) {
  if (!value) return '';
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-TW' : 'en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

export function ArticleList({ posts, locale }: { posts: Post[]; locale: Locale }) {
  return <div className="article-list">
    {posts.map(post => {
      const p = pickLocale(post, locale);
      return <Link href={`/articles/${post.slug}`} className="article-row" key={post.id}>
        <div className="article-row-meta">
          <span>{formatArticleDate(post.published_at, locale)}</span>
          {post.reading_minutes ? <span>{post.reading_minutes} min read</span> : null}
        </div>
        <div className="article-row-body">
          <h2>{p.title}</h2>
          {p.excerpt ? <p>{p.excerpt}</p> : null}
          {post.tags.length ? <ul className="article-tags" aria-label="Article tags">
            {post.tags.map(tag => <li key={tag}>{tag}</li>)}
          </ul> : null}
        </div>
      </Link>;
    })}
  </div>;
}
