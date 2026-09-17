'use server';
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { Resend } from 'resend';
import { adminDb } from '@/lib/db/admin';
import { isDemoMode } from '@/lib/db/config';
import { type ContactField, type ContactInput, validateContact } from '@/lib/contact/validate';

export type ContactState =
  | { status: 'idle' }
  | { status: 'ok'; emailed: boolean }
  | { status: 'error'; code: 'invalid' | 'rate' | 'generic'; fields?: ContactField[] };

const WINDOW = '1 hour', MAX_HITS = 5;

async function clientHash() {
  const list = await headers();
  const ip = list.get('x-forwarded-for')?.split(',')[0]?.trim() || list.get('x-real-ip') || 'unknown';
  const salt = process.env.CONTACT_HASH_SALT || process.env.CRON_SECRET || 'contact';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

async function allowRequest(db: ReturnType<typeof adminDb>, ipHash: string) {
  // Atomic upsert in Postgres (supabase/migrations/20260918000100_contact_rate_limit_fn.sql).
  const { data, error } = await db.rpc('contact_rate_limit_hit', { p_ip_hash: ipHash, p_limit: MAX_HITS, p_window: WINDOW });
  if (error) throw new Error('Unable to update rate limit.');
  return data === true;
}

async function sendEmail(input: ContactInput) {
  const key = process.env.RESEND_API_KEY, to = process.env.CONTACT_TO_EMAIL, from = process.env.CONTACT_FROM_EMAIL;
  if (!key || !to || !from) return false;
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from, to, replyTo: input.email,
    subject: `[Contact] ${input.subject || input.name}`,
    text: [`Name: ${input.name}`, `Email: ${input.email}`, `Locale: ${input.locale}`, '', input.message].join('\n'),
  });
  if (error) { console.error('Contact email failed:', error.message); return false; }
  return true;
}

export async function sendMessageAction(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const result = validateContact(Object.fromEntries(formData));
  if (!result.ok) {
    return result.reason === 'invalid' ? { status: 'error', code: 'invalid', fields: result.fields } : { status: 'error', code: 'generic' };
  }
  if (isDemoMode()) return { status: 'ok', emailed: false };
  try {
    const db = adminDb();
    const ipHash = await clientHash();
    if (!await allowRequest(db, ipHash)) return { status: 'error', code: 'rate' };
    const userAgent = (await headers()).get('user-agent')?.slice(0, 512) ?? null;
    const { error } = await db.from('messages').insert({
      name: result.data.name, email: result.data.email, subject: result.data.subject, body: result.data.message,
      locale: result.data.locale, ip_hash: ipHash, user_agent: userAgent,
    });
    if (error) throw new Error(error.message);
    const emailed = await sendEmail(result.data);
    return { status: 'ok', emailed };
  } catch (error) {
    console.error('Contact form failed:', error instanceof Error ? error.message : error);
    return { status: 'error', code: 'generic' };
  }
}
