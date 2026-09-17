import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/container';
import { requireAdminPage } from '@/lib/auth/admin';
import { adminNavLinks } from './nav';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export default async function AdminIndexPage() {
  const user = await requireAdminPage('/admin');

  return <Container className="admin-page">
    <header className="admin-heading">
      <p className="text-meta text-graphite">Admin</p>
      <h1>後台首頁</h1>
      <p>目前登入：{user.email}</p>
    </header>

    <section className="admin-panel" aria-labelledby="admin-sections">
      <h2 id="admin-sections">管理項目</h2>
      <dl className="admin-list">
        {adminNavLinks.filter(link => link.href !== '/admin').map(link => <div key={link.href}>
          <dt>{link.label}</dt>
          <dd><Link href={link.href}>{link.href}</Link></dd>
        </div>)}
      </dl>
    </section>
  </Container>;
}
