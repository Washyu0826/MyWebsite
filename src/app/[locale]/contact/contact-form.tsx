'use client';
import { useActionState, useEffect, useId, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CONTACT_FIELDS, CONTACT_LIMITS, contactDraftSchema, isContactFieldValid, type ContactField } from '@/lib/schema';
import { buttonVariants } from '@/components/ui/button';
import { cue } from '@/lib/audio/cue';
import { sendMessageAction, type ContactState } from './actions';

const FIELD_ERROR: Record<ContactField, 'errorName' | 'errorEmail' | 'errorMessage'> = { name: 'errorName', email: 'errorEmail', message: 'errorMessage' };
type Draft = { name: string; email: string; subject: string; message: string };
const EMPTY: Draft = { name: '', email: '', subject: '', message: '' };
const DRAFT_KEY = 'hsien-contact-draft';

// localStorage can throw outright (private windows, blocked site data) and can hold anything at
// all, so every access is guarded and every value re-validated before it reaches the form.
function readDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = contactDraftSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const draft = { ...EMPTY, ...parsed.data };
    return Object.values(draft).some(Boolean) ? draft : null;
  } catch { return null; }
}
function writeDraft(draft: Draft) {
  try {
    if (Object.values(draft).some(Boolean)) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch { /* storage unavailable: the form still works, the draft just will not survive */ }
}
function clearDraft() {
  try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* nothing to clean up */ }
}

export function ContactForm({ startedAt: initialStartedAt }: { startedAt: string }) {
  const t = useTranslations('Contact.form');
  const locale = useLocale();
  const id = useId();
  const [state, action, pending] = useActionState<ContactState, FormData>(sendMessageAction, { status: 'idle' });
  // Server-rendered so the form also submits without JavaScript, then replaced on mount so the
  // "time on page" check reflects the real client clock.
  const [startedAt, setStartedAt] = useState(initialStartedAt);
  const [values, setValues] = useState<Draft>(EMPTY);
  const [restored, setRestored] = useState(false);
  const [touched, setTouched] = useState<ContactField[]>([]);
  const summaryRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setStartedAt(String(Date.now())); }, []);
  useEffect(() => {
    const draft = readDraft();
    if (draft) { setValues(draft); setRestored(true); }
  }, []);
  useEffect(() => { if (state.status !== 'idle') summaryRef.current?.focus(); }, [state]);
  useEffect(() => { if (state.status === 'ok') { clearDraft(); cue('sent'); } }, [state]);

  const update = (field: keyof Draft, value: string) => {
    const next = { ...values, [field]: value };
    setValues(next);
    writeDraft(next);
    // Never nag mid-sentence: an error clears the moment the field becomes valid again.
    if (field !== 'subject' && isContactFieldValid(field, value)) setTouched(list => list.filter(item => item !== field));
  };
  const blur = (field: ContactField) => setTouched(list =>
    isContactFieldValid(field, values[field]) ? list.filter(item => item !== field) : list.includes(field) ? list : [...list, field]);

  const serverFields = state.status === 'error' && state.code === 'invalid' ? state.fields ?? [] : [];
  // A field the server rejected stops complaining as soon as the visitor fixes it.
  const invalid = (field: ContactField) => touched.includes(field) || (serverFields.includes(field) && !isContactFieldValid(field, values[field]));
  const fieldId = (field: string) => `${id}-${field}`;
  const errorId = (field: ContactField) => invalid(field) ? `${fieldId(field)}-error` : undefined;
  const summaryFields = CONTACT_FIELDS.filter(invalid).length ? CONTACT_FIELDS.filter(invalid) : serverFields;

  if (state.status === 'ok') {
    return <div ref={summaryRef} tabIndex={-1} role="status" className="contact-form-status contact-form-success">
      {t(state.emailed ? 'success' : 'successStored')}
    </div>;
  }

  return <form action={action} className="contact-form" noValidate aria-busy={pending}>
    {state.status === 'error' ? <div ref={summaryRef} tabIndex={-1} role="alert" className="contact-form-status contact-form-error">
      {state.code === 'invalid' ? <>
        <p>{t('errorInvalid')}</p>
        <ul>{summaryFields.map(field => <li key={field}><a href={`#${fieldId(field)}`}>{t(FIELD_ERROR[field])}</a></li>)}</ul>
      </> : <p>{t(state.code === 'rate' ? 'errorRate' : 'errorGeneric')}</p>}
    </div> : null}
    {restored ? <p role="status" className="contact-form-hint text-graphite">{t('draftRestored')}</p> : null}
    <input type="hidden" name="locale" value={locale} />
    <input type="hidden" name="startedAt" value={startedAt} />
    {/* Honeypot: hidden from people, filled by naive bots. */}
    <div className="contact-form-trap" aria-hidden="true">
      <label htmlFor={fieldId('website')}>Website</label>
      <input id={fieldId('website')} name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
    </div>
    <div className="contact-form-grid">
      <div className="contact-form-field">
        <label htmlFor={fieldId('name')}>{t('name')}<span className="contact-form-hint">{t('required')}</span></label>
        <input id={fieldId('name')} name="name" type="text" required maxLength={CONTACT_LIMITS.name} autoComplete="name"
          value={values.name} onChange={event => update('name', event.target.value)} onBlur={() => blur('name')}
          aria-invalid={invalid('name') || undefined} aria-describedby={errorId('name')} disabled={pending} />
        {invalid('name') ? <p id={errorId('name')} className="contact-form-field-error">{t('errorName')}</p> : null}
      </div>
      <div className="contact-form-field">
        <label htmlFor={fieldId('email')}>{t('email')}<span className="contact-form-hint">{t('required')}</span></label>
        <input id={fieldId('email')} name="email" type="email" required autoComplete="email" inputMode="email"
          value={values.email} onChange={event => update('email', event.target.value)} onBlur={() => blur('email')}
          aria-invalid={invalid('email') || undefined} aria-describedby={errorId('email')} disabled={pending} />
        {invalid('email') ? <p id={errorId('email')} className="contact-form-field-error">{t('errorEmail')}</p> : null}
      </div>
    </div>
    <div className="contact-form-field">
      <label htmlFor={fieldId('subject')}>{t('subject')}<span className="contact-form-hint">{t('optional')}</span></label>
      <input id={fieldId('subject')} name="subject" type="text" maxLength={CONTACT_LIMITS.subject} disabled={pending}
        value={values.subject} onChange={event => update('subject', event.target.value)} />
    </div>
    <div className="contact-form-field">
      <label htmlFor={fieldId('message')}>{t('message')}<span className="contact-form-hint">{t('required')}</span></label>
      <textarea id={fieldId('message')} name="message" required rows={7} minLength={CONTACT_LIMITS.message.min} maxLength={CONTACT_LIMITS.message.max}
        value={values.message} onChange={event => update('message', event.target.value)} onBlur={() => blur('message')}
        aria-invalid={invalid('message') || undefined} aria-describedby={errorId('message')} disabled={pending} />
      {invalid('message') ? <p id={errorId('message')} className="contact-form-field-error">{t('errorMessage')}</p> : null}
    </div>
    <button type="submit" className={buttonVariants()} disabled={pending}>{pending ? t('sending') : t('send')}</button>
  </form>;
}
