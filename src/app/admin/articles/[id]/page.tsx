import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container } from '@/components/container';
import { requireAdminPage } from '@/lib/auth/admin';
import { adminDb } from '@/lib/db/admin';
import type { Post } from '@/types/content';
import { listRevisions } from '@/lib/revisions';
import { ArticleForm, DeleteArticleForm } from '../article-form';
import { ArticleRevisions } from '../article-revisions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Edit Article Admin',
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ id: string }> };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getPostById(id: string): Promise<Post | null> {
  if (!uuidPattern.test(id)) return null;
  const { data, error } = await adminDb().from('posts').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`無法載入文章：${error.message}`);
  return data;
}

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' });
}

export default async function EditArticlePage({ params }: PageProps) {
  const { id } = await params;
  await requireAdminPage(`/admin/articles/${id}`);

  let post: Post | null = null;
  let loadError = '';
  try {
    post = await getPostById(id);
  } catch (error) {
    loadError = error instanceof Error ? error.message : '無法載入文章。';
  }

  if (loadError) {
    return <Container className="admin-page">
      <header className="admin-heading">
        <p className="text-meta text-graphite">Admin</p>
        <h1>編輯文章</h1>
      </header>
      <p className="admin-error" role="status">{loadError}</p>
      <p><Link className="text-[var(--indigo)] underline" href="/admin/articles">回到文章列表</Link></p>
    </Container>;
  }

  if (!post) notFound();

  // A missing revisions table (migration not applied yet) reads as "no history", not as an error.
  const revisions = await listRevisions(post.id);

  const isPublic = post.status === 'published' && !!post.published_at && new Date(post.published_at).getTime() <= Date.now();

  return <Container className="admin-page">
    <header className="admin-heading">
      <p className="text-meta text-graphite">Admin</p>
      <h1>編輯文章</h1>
      <p>
        {post.title_zh || post.title_en}
        {' '}· 建立於 {formatDate(post.created_at)} · 最後更新 {formatDate(post.updated_at)}
        {' '}<Link className="text-[var(--indigo)] underline" href="/admin/articles">回到文章列表</Link>
        {isPublic ? <>
          {' '}<a className="text-[var(--indigo)] underline" href={`/zh/articles/${post.slug}`} target="_blank" rel="noreferrer">查看公開頁面</a>
        </> : null}
      </p>
    </header>

    <section className="admin-panel" aria-labelledby="article-editor">
      <h2 id="article-editor">文章內容</h2>
      {/* Remounts after a restore so the editor shows the content that is now stored. */}
      <ArticleForm key={post.updated_at} post={post} />
    </section>

    <section className="admin-panel" aria-labelledby="article-revisions">
      <h2 id="article-revisions">修訂紀錄</h2>
      <ArticleRevisions postId={post.id} revisions={revisions} />
    </section>

    <section className="admin-panel" aria-labelledby="article-delete">
      <h2 id="article-delete">刪除文章</h2>
      <DeleteArticleForm id={post.id} slug={post.slug} />
    </section>
  </Container>;
}
