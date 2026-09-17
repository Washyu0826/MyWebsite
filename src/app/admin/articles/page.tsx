import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/container';
import { requireAdminPage } from '@/lib/auth/admin';
import { adminDb } from '@/lib/db/admin';
import type { Post } from '@/types/content';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Article Admin',
  robots: { index: false, follow: false },
};

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

async function listAdminPosts(): Promise<Post[]> {
  const { data, error } = await adminDb().from('posts').select('*')
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export default async function ArticleAdminPage() {
  await requireAdminPage('/admin/articles');

  let posts: Post[] = [];
  let loadError = '';
  try {
    posts = await listAdminPosts();
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Unable to load articles.';
  }

  return <Container className="admin-page admin-article-page">
    <header className="admin-heading">
      <p className="text-meta text-graphite">Admin</p>
      <h1>Article Manager</h1>
      <p>Write technical articles in Markdown, keep drafts private, schedule future posts, and publish when ready.</p>
    </header>

    <section className="admin-panel" aria-labelledby="article-list">
      <div className="admin-panel-heading">
        <div>
          <h2 id="article-list">Articles</h2>
          <p>{posts.length} total</p>
        </div>
        <Link className="admin-button" href="/admin/articles/new">New article</Link>
      </div>

      {loadError ? <p className="admin-error">{loadError}</p> : <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Published</th>
              <th>Updated</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {posts.length ? posts.map(post => <tr key={post.id}>
              <td>
                <strong>{post.title_en || post.title_zh}</strong>
                <span>{post.slug}</span>
              </td>
              <td>{post.status}</td>
              <td>{formatDate(post.published_at)}</td>
              <td>{formatDate(post.updated_at)}</td>
              <td>
                <Link className="admin-secondary-link" href={`/admin/articles/${post.id}`}>Edit</Link>
              </td>
            </tr>) : <tr>
              <td colSpan={5}>No articles yet.</td>
            </tr>}
          </tbody>
        </table>
      </div>}
    </section>
  </Container>;
}
