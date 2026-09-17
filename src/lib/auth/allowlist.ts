// No 'server-only' here: middleware (Edge) and unit tests import this module too.

/** Emails allowed to use /admin. ADMIN_EMAIL may hold one address or a comma-separated list. */
export function adminEmails(env: string | undefined = process.env.ADMIN_EMAIL): string[] {
  return (env || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined, env?: string): boolean {
  if (!email) return false;
  return adminEmails(env).includes(email.trim().toLowerCase());
}

/** Only allow post-login redirects back into /admin (no protocol-relative or external targets). */
export function safeAdminPath(value: string | null | undefined, fallback = '/admin'): string {
  const target = (value || '').trim();
  if (!target.startsWith('/admin')) return fallback;
  if (target.includes('//') || target.includes('\\') || /[\r\n]/.test(target)) return fallback;
  if (target !== '/admin' && !target.startsWith('/admin/') && !target.startsWith('/admin?')) return fallback;
  if (target.startsWith('/admin/login')) return fallback;
  return target;
}
