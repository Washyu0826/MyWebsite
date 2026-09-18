import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/container';
import { requireAdminPage } from '@/lib/auth/admin';
import { adminDb } from '@/lib/db/admin';
import type { Experience } from '@/types/content';
import { experienceKindLabels } from '../profile/validation';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Experience Admin',
  robots: { index: false, follow: false },
};

function formatDate(value: string | null) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'short', timeZone: 'UTC' });
}

async function listAdminExperiences(): Promise<Experience[]> {
  const { data, error } = await adminDb().from('experiences').select('*')
    .order('sort_order')
    .order('start_date', { ascending: false })
    .order('id');
  if (error) throw new Error(error.message);
  return data;
}

export default async function ExperienceAdminPage() {
  await requireAdminPage('/admin/experiences');

  let experiences: Experience[] = [];
  let loadError = '';
  try {
    experiences = await listAdminExperiences();
  } catch (error) {
    loadError = error instanceof Error ? error.message : '無法載入經歷。';
  }

  return <Container className="admin-page">
    <header className="admin-heading">
      <p className="text-meta text-graphite">Admin</p>
      <h1>經歷管理</h1>
      <p>管理首頁經歷區塊的工作、學歷、獲獎與活動。公開頁依排序值、再依開始日期由新到舊顯示，隱藏的項目不會出現。</p>
    </header>

    <section className="admin-panel" aria-labelledby="experience-list">
      <div className="admin-panel-heading">
        <div>
          <h2 id="experience-list">經歷列表</h2>
          <p>共 {experiences.length} 筆</p>
        </div>
        <Link className="admin-button" href="/admin/experiences/new">新增經歷</Link>
      </div>

      {loadError ? <p className="admin-error" role="status">{loadError}</p> : <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">單位／職稱</th>
              <th scope="col">類型</th>
              <th scope="col">期間</th>
              <th scope="col">排序</th>
              <th scope="col">顯示</th>
              <th scope="col">操作</th>
            </tr>
          </thead>
          <tbody>
            {experiences.length ? experiences.map(experience => <tr key={experience.id}>
              <td>
                <strong>{experience.org_zh || experience.org_en}</strong>
                <span>{experience.role_zh || experience.role_en || '-'}</span>
              </td>
              <td>
                <span className="inline-block rounded-full border border-[var(--rule)] px-2.5 py-0.5 text-xs text-[var(--graphite)]">
                  {experienceKindLabels[experience.kind]}
                </span>
              </td>
              <td>
                {formatDate(experience.start_date)} - {experience.is_current ? '至今' : formatDate(experience.end_date)}
              </td>
              <td>{experience.sort_order}</td>
              <td>{experience.is_visible ? '公開' : '隱藏'}</td>
              <td>
                <Link className="admin-secondary-link" href={`/admin/experiences/${experience.id}`}>編輯</Link>
              </td>
            </tr>) : <tr>
              <td colSpan={6}>還沒有任何經歷。</td>
            </tr>}
          </tbody>
        </table>
      </div>}
    </section>
  </Container>;
}
