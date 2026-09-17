import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Container } from '@/components/container';
import { getAdminUser } from '@/lib/auth/admin';
import { adminEmails, safeAdminPath } from '@/lib/auth/allowlist';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin Login',
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawNext = Array.isArray(params?.next) ? params?.next[0] : params?.next;
  const next = safeAdminPath(rawNext);

  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const hasAllowlist = adminEmails().length > 0;

  if (configured && await getAdminUser()) redirect(next);

  return <Container className="admin-page">
    <header className="admin-heading">
      <p className="text-meta text-graphite">Admin</p>
      <h1>管理員登入</h1>
      <p>使用 Supabase Auth 的 Email 與密碼登入，僅 ADMIN_EMAIL 名單內的帳號可進入後台。</p>
    </header>

    <section className="admin-panel" aria-labelledby="login">
      <h2 id="login">登入</h2>
      {!configured
        ? <p className="admin-error">尚未設定 Supabase。請在 .env.local 填入 NEXT_PUBLIC_SUPABASE_URL 與 NEXT_PUBLIC_SUPABASE_ANON_KEY，然後重啟 npm run dev。</p>
        : <>
          {!hasAllowlist && <p className="admin-error">尚未設定 ADMIN_EMAIL，目前沒有任何帳號可以登入後台。</p>}
          <LoginForm next={next} />
        </>}
    </section>
  </Container>;
}
