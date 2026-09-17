'use server';

import { redirect } from 'next/navigation';
import { sessionDb } from '@/lib/db/server';

export async function signOutAction() {
  try {
    const db = await sessionDb();
    await db.auth.signOut();
  } catch {
    // Missing config or no session: nothing to clear, still send the user to the login page.
  }
  redirect('/admin/login');
}
