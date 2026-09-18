import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/container';
import { requireAdminPage } from '@/lib/auth/admin';
import { ExperienceForm } from '../experience-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'New Experience Admin',
  robots: { index: false, follow: false },
};

export default async function NewExperiencePage() {
  await requireAdminPage('/admin/experiences/new');

  return <Container className="admin-page">
    <header className="admin-heading">
      <p className="text-meta text-graphite">Admin</p>
      <h1>新增經歷</h1>
      <p>
        建立一筆工作、學歷、獲獎或活動經歷。
        {' '}<Link className="text-[var(--indigo)] underline" href="/admin/experiences">回到經歷列表</Link>
      </p>
    </header>

    <section className="admin-panel" aria-labelledby="experience-editor">
      <h2 id="experience-editor">經歷內容</h2>
      <ExperienceForm experience={null} />
    </section>
  </Container>;
}
