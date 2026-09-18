import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/container';
import { requireAdminPage } from '@/lib/auth/admin';
import { ProjectForm } from '../project-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'New Project Admin',
  robots: { index: false, follow: false },
};

export default async function NewProjectPage() {
  await requireAdminPage('/admin/projects/new');

  return <Container className="admin-page">
    <header className="admin-heading">
      <p className="text-meta text-graphite">Admin</p>
      <h1>新增專案</h1>
      <p>
        先寫一種語言，再用 AI 翻譯產生另一種語言的草稿並校對。案例研究各段使用 Markdown；媒體與量化成果在建立後於編輯頁新增。
        {' '}<Link className="text-[var(--indigo)] underline" href="/admin/projects">回到專案列表</Link>
      </p>
    </header>

    <section className="admin-panel" aria-labelledby="project-editor">
      <h2 id="project-editor">專案內容</h2>
      <ProjectForm project={null} />
    </section>
  </Container>;
}
