import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/container';
import { requireAdminPage } from '@/lib/auth/admin';
import { ArticleForm } from '../article-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'New Article Admin',
  robots: { index: false, follow: false },
};

export default async function NewArticlePage() {
  await requireAdminPage('/admin/articles/new');

  return <Container className="admin-page">
    <header className="admin-heading">
      <p className="text-meta text-graphite">Admin</p>
      <h1>新增文章</h1>
      <p>
        先寫一種語言，再用 AI 翻譯產生另一種語言的草稿並校對。內文使用 Markdown。
        {' '}<Link className="text-[var(--indigo)] underline" href="/admin/articles">回到文章列表</Link>
      </p>
    </header>

    <section className="admin-panel" aria-labelledby="article-editor">
      <h2 id="article-editor">文章內容</h2>
      <ArticleForm post={null} />
    </section>
  </Container>;
}
