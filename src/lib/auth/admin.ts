import 'server-only';
import { redirect } from 'next/navigation';
import { sessionDb } from '@/lib/db/server';
import { isAdminEmail } from './allowlist';

export { adminEmails, isAdminEmail } from './allowlist';

export type AdminUser = { id: string; email: string };

/** Returns the signed-in admin, or null when nobody (or a non-admin) is signed in. Never throws. */
export async function getAdminUser(): Promise<AdminUser | null> {
  try {
    const db = await sessionDb();
    const { data, error } = await db.auth.getUser();
    if (error || !data.user?.email) return null;
    if (!isAdminEmail(data.user.email)) return null;
    return { id: data.user.id, email: data.user.email };
  } catch {
    return null;
  }
}

/** For Server Actions and Route Handlers: throws when the caller is not an admin. */
export async function requireAdmin(): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}

/** For admin pages (Server Components): redirects to the login page when not signed in as admin. */
export async function requireAdminPage(next?: string): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!user) {
    const target = next ? `/admin/login?next=${encodeURIComponent(next)}` : '/admin/login';
    redirect(target);
  }
  return user;
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof Error && error.message === 'UNAUTHORIZED';
}
