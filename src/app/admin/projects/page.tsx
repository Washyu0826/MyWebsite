import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/container';
import { requireAdminPage } from '@/lib/auth/admin';
import { adminDb } from '@/lib/db/admin';
import type { ContentStatus, Project } from '@/types/content';
import { isPubliclyVisible, projectTagLabels, statusLabels, type ProjectTag } from './fields';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Project Admin',
  robots: { index: false, follow: false },
};

const statusBadgeClass: Record<ContentStatus, string> = {
  draft: 'bg-[var(--ash)] text-[var(--graphite)]',
  scheduled: 'bg-amber-100 text-amber-900',
  published: 'bg-emerald-100 text-emerald-900',
  archived: 'bg-neutral-200 text-neutral-700',
};

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' });
}

function tagLabel(tag: string) {
  return (projectTagLabels as Record<string, string>)[tag as ProjectTag] || tag;
}

async function listAdminProjects(): Promise<Project[]> {
  const { data, error } = await adminDb().from('projects').select('*')
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export default async function ProjectAdminPage() {
  await requireAdminPage('/admin/projects');

  let projects: Project[] = [];
  let loadError = '';
  try {
    projects = await listAdminProjects();
  } catch (error) {
    loadError = error instanceof Error ? error.message : '無法載入專案。';
  }

  return <Container className="admin-page">
    <header className="admin-heading">
      <p className="text-meta text-graphite">Admin</p>
      <h1>專案管理</h1>
      <p>以案例研究的方式整理作品：問題、解法、成果與個人貢獻，加上截圖與量化數字。草稿不會公開，排程會在指定時間自動發布。</p>
    </header>

    <section className="admin-panel" aria-labelledby="project-list">
      <div className="admin-panel-heading">
        <div>
          <h2 id="project-list">專案</h2>
          <p>共 {projects.length} 個</p>
        </div>
        <Link className="admin-button" href="/admin/projects/new">新增專案</Link>
      </div>

      {loadError ? <p className="admin-error" role="status">{loadError}</p> : <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>標題</th>
              <th>標籤</th>
              <th>狀態</th>
              <th>精選</th>
              <th>排序</th>
              <th>最後更新</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {projects.length ? projects.map(project => {
              const isPublic = isPubliclyVisible(project);
              return <tr key={project.id}>
                <td>
                  <strong>{project.title_zh || project.title_en}</strong>
                  {project.title_en && project.title_en !== project.title_zh ? <span>{project.title_en}</span> : null}
                  <span>{project.slug}</span>
                </td>
                <td>{project.tags.length ? project.tags.map(tagLabel).join('、') : '-'}</td>
                <td>
                  <span className={`inline-block rounded-sm px-2 py-0.5 text-xs font-medium ${statusBadgeClass[project.status]}`}>
                    {statusLabels[project.status]}
                  </span>
                  {project.status === 'scheduled' && project.published_at ? <span className="block text-xs text-[var(--graphite)]">{formatDate(project.published_at)}</span> : null}
                </td>
                <td>{project.is_featured ? '是' : '-'}</td>
                <td>{project.sort_order}</td>
                <td>{formatDate(project.updated_at)}</td>
                <td>
                  <div className="grid gap-1">
                    <Link className="admin-secondary-link" href={`/admin/projects/${project.id}`}>編輯</Link>
                    {isPublic ? <a className="text-xs text-[var(--indigo)] underline" href={`/zh/projects/${project.slug}`} target="_blank" rel="noreferrer">公開頁面</a> : null}
                  </div>
                </td>
              </tr>;
            }) : <tr>
              <td colSpan={7}>還沒有專案。按「新增專案」建立第一個案例。</td>
            </tr>}
          </tbody>
        </table>
      </div>}
    </section>
  </Container>;
}
