import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { getAdminUser } from '@/lib/auth/admin';
import { signOutAction } from './actions';
import { AdminSidebar } from './admin-sidebar';
import '../globals.css';
import '../../styles/admin.css';
import '../../styles/assets.css';

export const metadata: Metadata = {
  title: 'Resume Admin',
  robots: { index: false, follow: false },
};

// viewport-fit=cover + the env(safe-area-inset-*) padding in admin.css keeps the bar clear of the notch.
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // No redirect here: the login page shares this layout. Pages call requireAdminPage() themselves.
  const user = await getAdminUser();

  return <html lang="zh-TW" suppressHydrationWarning>
    <body className="antialiased">
      <a className="admin-skip-link" href="#main-content">跳到主要內容</a>
      <div className="admin-shell">
        <header className="admin-topbar">
          <span className="admin-topbar-brand">Admin</span>
          {user
            ? <form action={signOutAction} className="admin-topbar-user">
              <span className="text-graphite" style={{ overflowWrap: 'anywhere' }}>{user.email}</span>
              <button className="text-link" type="submit">登出</button>
            </form>
            : <Link className="text-link" href="/admin/login">登入</Link>}
        </header>
        <AdminSidebar />
        <main id="main-content" className="admin-main" tabIndex={-1}>{children}</main>
      </div>
    </body>
  </html>;
}
