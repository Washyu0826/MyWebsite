import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container } from '@/components/container';
import { requireAdminPage } from '@/lib/auth/admin';
import { adminDb } from '@/lib/db/admin';
import type { Experience } from '@/types/content';
import { experienceKindLabels, uuidPattern } from '../../profile/validation';
import { DeleteExperienceForm, ExperienceForm } from '../experience-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Edit Experience Admin',
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ id: string }> };

async function getExperienceById(id: string): Promise<Experience | null> {
  if (!uuidPattern.test(id)) return null;
  const { data, error } = await adminDb().from('experiences').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`無法載入經歷：${error.message}`);
  return data;
}

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' });
}

export default async function EditExperiencePage({ params }: PageProps) {
  const { id } = await params;
  await requireAdminPage(`/admin/experiences/${id}`);

  let experience: Experience | null = null;
  let loadError = '';
  try {
    experience = await getExperienceById(id);
  } catch (error) {
    loadError = error instanceof Error ? error.message : '無法載入經歷。';
  }

  if (loadError) {
    return <Container className="admin-page">
      <header className="admin-heading">
        <p className="text-meta text-graphite">Admin</p>
        <h1>編輯經歷</h1>
      </header>
      <p className="admin-error" role="status">{loadError}</p>
      <p><Link className="text-[var(--indigo)] underline" href="/admin/experiences">回到經歷列表</Link></p>
    </Container>;
  }

  if (!experience) notFound();

  const label = [experience.org_zh || experience.org_en, experience.role_zh || experience.role_en].filter(Boolean).join(' · ');

  return <Container className="admin-page">
    <header className="admin-heading">
      <p className="text-meta text-graphite">Admin</p>
      <h1>編輯經歷</h1>
      <p>
        {experienceKindLabels[experience.kind]} · {label}
        {' '}· 建立於 {formatDate(experience.created_at)} · 最後更新 {formatDate(experience.updated_at)}
        {' '}<Link className="text-[var(--indigo)] underline" href="/admin/experiences">回到經歷列表</Link>
      </p>
    </header>

    <section className="admin-panel" aria-labelledby="experience-editor">
      <h2 id="experience-editor">經歷內容</h2>
      <ExperienceForm experience={experience} />
    </section>

    <section className="admin-panel" aria-labelledby="experience-delete">
      <h2 id="experience-delete">刪除經歷</h2>
      <DeleteExperienceForm id={experience.id} label={label} />
    </section>
  </Container>;
}
