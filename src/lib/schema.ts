import { z } from 'zod';

// Single source of truth for the contact rules: the client validates fields on blur with the
// same schemas the Server Action parses with, so the two can never drift apart.
export const CONTACT_LIMITS = { name: 80, subject: 200, message: { min: 10, max: 4000 }, minSeconds: 3 } as const;
export type ContactField = 'name' | 'email' | 'message';
export const CONTACT_FIELDS: readonly ContactField[] = ['name', 'email', 'message'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// FormData entries can be File objects; anything that is not a string counts as empty.
const text = z.unknown().transform(value => (typeof value === 'string' ? value.trim() : ''));

export const contactFieldSchema = {
  name: text.pipe(z.string().min(1).max(CONTACT_LIMITS.name)),
  email: text.pipe(z.string().min(1).max(254).regex(EMAIL)),
  message: text.pipe(z.string().min(CONTACT_LIMITS.message.min).max(CONTACT_LIMITS.message.max)),
} satisfies Record<ContactField, z.ZodType<string, z.ZodTypeDef, unknown>>;

export const contactSchema = z.object({
  name: contactFieldSchema.name,
  email: contactFieldSchema.email,
  message: contactFieldSchema.message,
  subject: text.transform(value => value.slice(0, CONTACT_LIMITS.subject)),
  locale: text.transform((value): 'zh' | 'en' => (value === 'en' ? 'en' : 'zh')),
});
export type ContactInput = z.infer<typeof contactSchema>;

// Honeypot plus "time on page": not user-facing rules, so they stay outside the field schemas.
export const contactGuardSchema = z.object({ website: text, startedAt: text });

export function isContactFieldValid(field: ContactField, value: string) {
  return contactFieldSchema[field].safeParse(value).success;
}

// The draft kept in browser storage between reloads; unknown shapes are dropped.
export const contactDraftSchema = z.object({
  name: z.string().max(CONTACT_LIMITS.name).catch(''),
  email: z.string().max(254).catch(''),
  subject: z.string().max(CONTACT_LIMITS.subject).catch(''),
  message: z.string().max(CONTACT_LIMITS.message.max).catch(''),
}).partial();
export type ContactDraft = z.infer<typeof contactDraftSchema>;
