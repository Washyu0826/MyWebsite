// Pure validation for the contact form; no server imports so it can be unit-tested directly.
export const CONTACT_LIMITS = { name: 80, subject: 200, message: { min: 10, max: 4000 }, minSeconds: 3 } as const;
export type ContactField = 'name' | 'email' | 'message';
export type ContactInput = {
  name: string; email: string; subject: string; message: string; locale: 'zh' | 'en';
};
export type ContactValidation =
  | { ok: true; data: ContactInput }
  | { ok: false; reason: 'spam' }
  | { ok: false; reason: 'invalid'; fields: ContactField[] };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function text(value: FormDataEntryValue | string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}
export function validateContact(raw: Record<string, FormDataEntryValue | string | null | undefined>, now = Date.now()): ContactValidation {
  // Honeypot must stay empty and the form must have been open for at least a few seconds.
  const startedAt = Number(text(raw.startedAt));
  if (text(raw.website) || !Number.isFinite(startedAt) || startedAt <= 0 || now - startedAt < CONTACT_LIMITS.minSeconds * 1000) {
    return { ok: false, reason: 'spam' };
  }
  const name = text(raw.name), email = text(raw.email), message = text(raw.message);
  const subject = text(raw.subject).slice(0, CONTACT_LIMITS.subject);
  const fields: ContactField[] = [];
  if (!name || name.length > CONTACT_LIMITS.name) fields.push('name');
  if (!EMAIL.test(email) || email.length > 254) fields.push('email');
  if (message.length < CONTACT_LIMITS.message.min || message.length > CONTACT_LIMITS.message.max) fields.push('message');
  if (fields.length) return { ok: false, reason: 'invalid', fields };
  const locale = text(raw.locale) === 'en' ? 'en' : 'zh';
  return { ok: true, data: { name, email, subject, message, locale } };
}
