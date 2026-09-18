import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container } from '@/components/container';
import { requireAdminPage } from '@/lib/auth/admin';
import { adminDb } from '@/lib/db/admin';
import type { Project, ProjectMedia, ProjectMetric } from '@/types/content';
import { isPubliclyVisible, uuidPattern } from '../fields';
import { MediaSection, MetricSection } from '../media-form';
import { DeleteProjectForm, ProjectForm } from '../project-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Edit Project Admin',
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ id: string }> };

type ProjectDetail = { project: Project; media: ProjectMedia[]; metrics: ProjectMetric[] };

async function getProjectDetail(id: string): Promise<ProjectDetail | null> {
  if (!uuidPattern.test(id)) return null;
  const db = adminDb();
  const { data, error } = await db.from('projects').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`無法載入專案：${error.message}`);
  if (!data) return null;
  const [media, metrics] = await Promise.all([
    db.from('project_media').select('*').eq('project_id', id).order('sort_order').order('created_at'),
    db.from('project_metrics').select('*').eq('project_id', id).order('sort_order').order('id'),
  ]);
  if (media.error) throw new Error(`無法載入媒體：${media.error.message}`);
  if (metrics.error) throw new Error(`無法載入量化成果：${metrics.error.message}`);
  return { project: data, media: media.data, metrics: metrics.data };
}

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' });
}

export default async function EditProjectPage({ params }: PageProps) {
  const { id } = await params;
  await requireAdminPage(`/admin/projects/${id}`);

  let detail: ProjectDetail | null = null;
  let loadError = '';
  try {
    detail = await getProjectDetail(id);
  } catch (error) {
    loadError = error instanceof Error ? error.message : '無法載入專案。';
  }

  if (loadError) {
    return <Container className="admin-page">
      <header className="admin-heading">
        <p className="text-meta text-graphite">Admin</p>
        <h1>編輯專案</h1>
      </header>
      <p className="admin-error" role="status">{loadError}</p>
      <p><Link className="text-[var(--indigo)] underline" href="/admin/projects">回到專案列表</Link></p>
    </Container>;
  }

  if (!detail) notFound();

  const { project, media, metrics } = detail;
  const isPublic = isPubliclyVisible(project);

  return <Container className="admin-page">
    <header className="admin-heading">
      <p className="text-meta text-graphite">Admin</p>
      <h1>編輯專案</h1>
      <p>
        {project.title_zh || project.title_en}
        {' '}· 建立於 {formatDate(project.created_at)} · 最後更新 {formatDate(project.updated_at)}
        {' '}<Link className="text-[var(--indigo)] underline" href="/admin/projects">回到專案列表</Link>
        {isPublic ? <>
          {' '}<a className="text-[var(--indigo)] underline" href={`/zh/projects/${project.slug}`} target="_blank" rel="noreferrer">查看公開頁面</a>
        </> : null}
      </p>
    </header>

    <section className="admin-panel" aria-labelledby="project-editor">
      <h2 id="project-editor">專案內容</h2>
      <ProjectForm project={project} />
    </section>

    <section className="admin-panel" aria-labelledby="project-media">
      <h2 id="project-media">媒體（{media.length}）</h2>
      <MediaSection projectId={project.id} slug={project.slug} media={media} />
    </section>

    <section className="admin-panel" aria-labelledby="project-metrics">
      <h2 id="project-metrics">量化成果（{metrics.length}）</h2>
      <MetricSection projectId={project.id} metrics={metrics} />
    </section>

    <section className="admin-panel" aria-labelledby="project-delete">
      <h2 id="project-delete">刪除專案</h2>
      <DeleteProjectForm id={project.id} slug={project.slug} />
    </section>
  </Container>;
}
