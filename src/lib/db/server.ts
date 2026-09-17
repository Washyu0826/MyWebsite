import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import { publicCredentials } from './config';

// Cookie-free anonymous client: cached public data must never depend on a user session.
export function publicDb() {
  const { url, key } = publicCredentials();
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function sessionDb() {
  const { url, key } = publicCredentials();
  const jar = await cookies();
  return createServerClient<Database>(url, key, { cookies: {
    getAll: () => jar.getAll(),
    setAll(values) {
      try { values.forEach(({ name, value, options }) => jar.set(name, value, options)); }
      catch { /* Server Components cannot write cookies; auth middleware will refresh in Phase 2. */ }
    },
  } });
}
