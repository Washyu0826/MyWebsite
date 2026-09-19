// Pure validation for the contact form; no server imports so it can be unit-tested directly.
// The rules themselves live in src/lib/schema.ts and are shared with the client component.
import { CONTACT_FIELDS, CONTACT_LIMITS, contactGuardSchema, contactSchema, type ContactField, type ContactInput } from '../schema';
export { CONTACT_LIMITS };
export type { ContactField, ContactInput };
export type ContactValidation =
  | { ok: true; data: ContactInput }
  | { ok: false; reason: 'spam' }
  | { ok: false; reason: 'invalid'; fields: ContactField[] };
export function validateContact(raw: Record<string, FormDataEntryValue | string | null | undefined>, now = Date.now()): ContactValidation {
  // Honeypot must stay empty and the form must have been open for at least a few seconds.
  const guard = contactGuardSchema.parse(raw);
  const startedAt = Number(guard.startedAt);
  if (guard.website || !Number.isFinite(startedAt) || startedAt <= 0 || now - startedAt < CONTACT_LIMITS.minSeconds * 1000) {
    return { ok: false, reason: 'spam' };
  }
  const parsed = contactSchema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  const failed = new Set(parsed.error.issues.map(issue => issue.path[0]));
  return { ok: false, reason: 'invalid', fields: CONTACT_FIELDS.filter(field => failed.has(field)) };
}
