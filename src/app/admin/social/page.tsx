import type { Metadata } from 'next';
import { Container } from '@/components/container';
import { requireAdminPage } from '@/lib/auth/admin';
import { adminDb } from '@/lib/db/admin';
import type { SocialLink } from '@/types/content';
import { AddSocialLinkForm, PlatformSuggestions, SocialLinkItem } from './social-forms';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Social Links Admin',
  robots: { index: false, follow: false },
};

async function listAdminSocialLinks(): Promise<SocialLink[]> {
  const { data, error } = await adminDb().from('social_links').select('*')
    .order('sort_order')
    .order('id');
  if (error) throw new Error(error.message);
  return data;
}

export default async function SocialAdminPage() {
  await requireAdminPage('/admin/social');

  let links: SocialLink[] = [];
  let loadError = '';
  try {
    links = await listAdminSocialLinks();
  } catch (error) {
    loadError = error instanceof Error ? error.message : '無法載入社群連結。';
  }

  return <Container className="admin-page">
    <header className="admin-heading">
      <p className="text-meta text-graphite">Admin</p>
      <h1>社群連結</h1>
      <p>管理首頁與聯絡頁顯示的社群與聯絡連結。依排序值由小到大顯示，隱藏的連結不會出現在公開頁面。</p>
    </header>

    <PlatformSuggestions />

    <section className="admin-panel" aria-labelledby="social-list">
      <div className="admin-panel-heading">
        <div>
          <h2 id="social-list">現有連結</h2>
          <p>共 {links.length} 筆</p>
        </div>
      </div>
      {loadError
        ? <p className="admin-error" role="status">{loadError}</p>
        : links.length
          ? <div className="grid gap-6">{links.map(link => <SocialLinkItem key={link.id} link={link} />)}</div>
          : <p className="text-sm text-[var(--graphite)]">還沒有任何社群連結，請在下方新增。</p>}
    </section>

    <section className="admin-panel" aria-labelledby="social-add">
      <h2 id="social-add">新增連結</h2>
      <AddSocialLinkForm />
    </section>
  </Container>;
}
