'use server';

import { redirect } from 'next/navigation';
import { isAdminEmail, safeAdminPath } from '@/lib/auth/allowlist';
import { sessionDb } from '@/lib/db/server';

export type SignInState = { ok: boolean; message: string };

export async function signInAction(_: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const next = safeAdminPath(String(formData.get('next') || ''));
  if (!email || !password) return { ok: false, message: '請輸入 Email 與密碼。' };

  let db: Awaited<ReturnType<typeof sessionDb>>;
  try {
    db = await sessionDb();
  } catch {
    return { ok: false, message: '尚未設定 Supabase 連線資訊（NEXT_PUBLIC_SUPABASE_URL、NEXT_PUBLIC_SUPABASE_ANON_KEY）。' };
  }

  if (!isAdminEmail(email)) {
    // Do not even attempt the sign-in for non-admin accounts.
    return { ok: false, message: '此帳號沒有管理權限。' };
  }

  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { ok: false, message: 'Email 或密碼不正確。' };

  if (!isAdminEmail(data.user.email)) {
    await db.auth.signOut();
    return { ok: false, message: '此帳號沒有管理權限。' };
  }

  redirect(next);
}
