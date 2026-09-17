import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/container';
import { getAdminUser } from '@/lib/auth/admin';
import { signOutAction } from './actions';
import { adminNavLinks } from './nav';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Resume Admin',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // No redirect here: the login page shares this layout. Pages call requireAdminPage() themselves.
  const user = await getAdminUser();

  return <html lang="zh-TW" suppressHydrationWarning>
    <body className="antialiased">
      <header className="site-header">
        <Container className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3 text-sm">
          <nav aria-label="後台導覽" className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className="text-meta text-graphite">Admin</span>
            {adminNavLinks.map(link => <Link key={link.href} className="nav-link" href={link.href}>{link.label}</Link>)}
          </nav>
          {user
            ? <form action={signOutAction} className="flex items-center gap-4">
              <span className="text-graphite" style={{ overflowWrap: 'anywhere' }}>{user.email}</span>
              <button className="text-link" type="submit">登出</button>
            </form>
            : <Link className="text-link" href="/admin/login">登入</Link>}
        </Container>
      </header>
      <main id="main-content" tabIndex={-1}>{children}</main>
    </body>
  </html>;
}
