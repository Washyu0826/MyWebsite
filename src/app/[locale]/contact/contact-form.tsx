'use client';
import { useActionState, useEffect, useId, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CONTACT_LIMITS, type ContactField } from '@/lib/contact/validate';
import { buttonVariants } from '@/components/ui/button';
import { sendMessageAction, type ContactState } from './actions';

const FIELD_ERROR: Record<ContactField, 'errorName' | 'errorEmail' | 'errorMessage'> = { name: 'errorName', email: 'errorEmail', message: 'errorMessage' };

export function ContactForm() {
  const t = useTranslations('Contact.form');
  const locale = useLocale();
  const id = useId();
  const [state, action, pending] = useActionState<ContactState, FormData>(sendMessageAction, { status: 'idle' });
  // Rendered by the server as empty and filled on mount so the "time on page" check reflects the real client clock.
  const [startedAt, setStartedAt] = useState('');
  const summaryRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setStartedAt(String(Date.now())); }, []);
  useEffect(() => { if (state.status !== 'idle') summaryRef.current?.focus(); }, [state]);

  const fields = state.status === 'error' && state.code === 'invalid' ? state.fields ?? [] : [];
  const invalid = (field: ContactField) => fields.includes(field);
  const fieldId = (field: string) => `${id}-${field}`;
  const errorId = (field: ContactField) => invalid(field) ? `${fieldId(field)}-error` : undefined;

  if (state.status === 'ok') {
    return <div ref={summaryRef} tabIndex={-1} role="status" className="contact-form-status contact-form-success">
      {t(state.emailed ? 'success' : 'successStored')}
    </div>;
  }

  return <form action={action} className="contact-form" noValidate aria-busy={pending}>
    {state.status === 'error' ? <div ref={summaryRef} tabIndex={-1} role="alert" className="contact-form-status contact-form-error">
      {state.code === 'invalid' ? <>
        <p>{t('errorInvalid')}</p>
        <ul>{fields.map(field => <li key={field}><a href={`#${fieldId(field)}`}>{t(FIELD_ERROR[field])}</a></li>)}</ul>
      </> : <p>{t(state.code === 'rate' ? 'errorRate' : 'errorGeneric')}</p>}
    </div> : null}
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
          aria-invalid={invalid('name') || undefined} aria-describedby={errorId('name')} disabled={pending} />
        {invalid('name') ? <p id={errorId('name')} className="contact-form-field-error">{t('errorName')}</p> : null}
      </div>
      <div className="contact-form-field">
        <label htmlFor={fieldId('email')}>{t('email')}<span className="contact-form-hint">{t('required')}</span></label>
        <input id={fieldId('email')} name="email" type="email" required autoComplete="email" inputMode="email"
          aria-invalid={invalid('email') || undefined} aria-describedby={errorId('email')} disabled={pending} />
        {invalid('email') ? <p id={errorId('email')} className="contact-form-field-error">{t('errorEmail')}</p> : null}
      </div>
    </div>
    <div className="contact-form-field">
      <label htmlFor={fieldId('subject')}>{t('subject')}<span className="contact-form-hint">{t('optional')}</span></label>
      <input id={fieldId('subject')} name="subject" type="text" maxLength={CONTACT_LIMITS.subject} disabled={pending} />
    </div>
    <div className="contact-form-field">
      <label htmlFor={fieldId('message')}>{t('message')}<span className="contact-form-hint">{t('required')}</span></label>
      <textarea id={fieldId('message')} name="message" required rows={7} minLength={CONTACT_LIMITS.message.min} maxLength={CONTACT_LIMITS.message.max}
        aria-invalid={invalid('message') || undefined} aria-describedby={errorId('message')} disabled={pending} />
      {invalid('message') ? <p id={errorId('message')} className="contact-form-field-error">{t('errorMessage')}</p> : null}
    </div>
    <button type="submit" className={buttonVariants()} disabled={pending || !startedAt}>{pending ? t('sending') : t('send')}</button>
  </form>;
}
