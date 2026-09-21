import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { validateContact } from '@/lib/contact/validate';
import { message, renderWithProviders } from './harness';

// The real action reaches for Supabase, Resend and next/headers. The pure validator it delegates to
// is the part worth exercising from the component, so the mock keeps that and drops the transport.
const action = vi.hoisted(() => ({ submissions: [] as FormData[], reply: null as unknown, realClock: false }));

vi.mock('../../src/app/[locale]/contact/actions', () => ({
  async sendMessageAction(_previous: unknown, formData: FormData) {
    action.submissions.push(formData);
    if (action.reply) return action.reply;
    // A test fills the form in milliseconds, which the anti-spam floor reads as a bot. Unless a test
    // is checking that floor, stand the clock forward to what a person would plausibly take.
    const now = action.realClock ? Date.now() : Number(formData.get('startedAt')) + 10_000;
    const result = validateContact(Object.fromEntries(formData), now);
    if (result.ok) return { status: 'ok', emailed: true };
    return result.reason === 'invalid' ? { status: 'error', code: 'invalid', fields: result.fields } : { status: 'error', code: 'generic' };
  },
}));

const { ContactForm } = await import('@/app/[locale]/contact/contact-form');

const DRAFT_KEY = 'hsien-contact-draft';
const t = (key: string) => message('zh', 'Contact.form.' + key);
// Whatever the server rendered; the component replaces it with the client clock on mount.
const serverStartedAt = '1700000000000';

function renderForm() {
  action.submissions = [];
  action.reply = null;
  action.realClock = false;
  return renderWithProviders(<ContactForm startedAt={serverStartedAt} />);
}

const field = {
  name: () => screen.getByLabelText(new RegExp(t('name'))),
  email: () => screen.getByLabelText(new RegExp(t('email'))),
  message: () => screen.getByLabelText(new RegExp(t('message'))),
};
const submit = () => screen.getByRole('button', { name: t('send') });

type User = ReturnType<typeof renderForm>['user'];

async function fillValid(user: User) {
  await user.type(field.name(), 'Ada');
  await user.type(field.email(), 'ada@example.com');
  await user.type(field.message(), 'I would like to talk about the search project.');
}

describe('ContactForm', () => {
  it('ships a server-rendered timestamp and replaces it with the client clock on mount', async () => {
    renderForm();
    const startedAt = () => document.querySelector<HTMLInputElement>('input[name="startedAt"]')?.value;
    await waitFor(() => expect(startedAt()).not.toBe(serverStartedAt));
    expect(Number(startedAt())).toBeGreaterThan(Number(serverStartedAt));
    // Submitting without JavaScript has to stay possible, so the button is never gated on hydration.
    expect(submit()).toBeEnabled();
  });

  it('carries a honeypot that is hidden from assistive technology and left empty', () => {
    const { container } = renderForm();
    const trap = container.querySelector('.contact-form-trap');
    expect(trap).toHaveAttribute('aria-hidden', 'true');
    expect(trap?.querySelector<HTMLInputElement>('input[name="website"]')).toHaveValue('');
    expect(trap?.querySelector('input')).toHaveAttribute('tabindex', '-1');
  });

  it('flags a field on blur and stops complaining as soon as it is corrected', async () => {
    const { user } = renderForm();
    await user.type(field.email(), 'not-an-email');
    await user.tab();
    await waitFor(() => expect(field.email()).toHaveAttribute('aria-invalid', 'true'));

    const describedBy = field.email().getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent(t('errorEmail'));

    await user.type(field.email(), '@example.com');
    await waitFor(() => expect(field.email()).not.toHaveAttribute('aria-invalid'));
    expect(field.email()).not.toHaveAttribute('aria-describedby');
  });

  it('leaves an untouched field alone', async () => {
    const { user } = renderForm();
    // Nothing is flagged before anyone has touched it, and leaving one field does not accuse the next.
    expect(field.name()).not.toHaveAttribute('aria-invalid');
    expect(field.email()).not.toHaveAttribute('aria-invalid');
    expect(field.message()).not.toHaveAttribute('aria-invalid');
    await user.click(field.name());
    await user.tab();
    await waitFor(() => expect(field.name()).toHaveAttribute('aria-invalid', 'true'));
    expect(field.email()).not.toHaveAttribute('aria-invalid');
    expect(field.message()).not.toHaveAttribute('aria-invalid');
  });

  it('asks for three fields and no more', () => {
    renderForm();
    // The subject line was optional, rarely filled and one more thing between a reader and a
    // message, so it is gone. The server still accepts the field; the form no longer offers it.
    expect(screen.getAllByRole('textbox')).toHaveLength(3);
    expect(screen.queryByLabelText(/主旨|Subject/)).toBeNull();
  });

  it('summarises a server rejection in an alert that takes focus and links to each field', async () => {
    const { user } = renderForm();
    action.reply = { status: 'error', code: 'invalid', fields: ['email', 'message'] };
    await fillValid(user);
    await user.click(submit());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(t('errorInvalid'));
    await waitFor(() => expect(alert).toHaveFocus());
    expect(within(alert).getByRole('link', { name: t('errorEmail') })).toHaveAttribute('href', '#' + field.email().id);
    expect(within(alert).getByRole('link', { name: t('errorMessage') })).toBeInTheDocument();
  });

  it('shows the rate-limit copy rather than the generic failure when the server says so', async () => {
    const { user } = renderForm();
    action.reply = { status: 'error', code: 'rate' };
    await fillValid(user);
    await user.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent(t('errorRate'));
  });

  it('rejects a submission that arrives faster than a person could type it', async () => {
    const { user } = renderForm();
    action.realClock = true;
    await fillValid(user);
    await user.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent(t('errorGeneric'));
  });

  it('submits every field and swaps the whole form for a success message', async () => {
    const { user } = renderForm();
    await fillValid(user);
    await user.click(submit());

    expect(await screen.findByRole('status')).toHaveTextContent(t('success'));
    expect(screen.queryByRole('button', { name: t('send') })).toBeNull();

    const sent = action.submissions.at(-1)!;
    expect(sent.get('name')).toBe('Ada');
    expect(sent.get('subject')).toBeNull();
    expect(sent.get('locale')).toBe('zh');
    expect(sent.get('website')).toBe('');
  });

  it('distinguishes a stored-but-not-emailed result from a delivered one', async () => {
    const { user } = renderForm();
    action.reply = { status: 'ok', emailed: false };
    await fillValid(user);
    await user.click(submit());
    expect(await screen.findByRole('status')).toHaveTextContent(t('successStored'));
  });

  it('keeps a draft in local storage while typing and drops it once the message is sent', async () => {
    const { user } = renderForm();
    await user.type(field.name(), 'Ada');
    await waitFor(() => expect(JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}')).toMatchObject({ name: 'Ada' }));
    await user.type(field.email(), 'ada@example.com');
    await user.type(field.message(), 'I would like to talk about the search project.');
    await user.click(submit());
    await screen.findByRole('status');
    await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).toBeNull());
  });

  it('restores a saved draft on mount and says so', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ name: 'Ada', email: 'ada@example.com', message: 'Half a thought.' }));
    renderForm();
    await waitFor(() => expect(field.name()).toHaveValue('Ada'));
    expect(field.message()).toHaveValue('Half a thought.');
    expect(screen.getByText(t('draftRestored'))).toBeInTheDocument();
  });

  it('ignores stored rubbish rather than feeding it back into the form', async () => {
    localStorage.setItem(DRAFT_KEY, '{"name":42,"email":[]}');
    renderForm();
    await waitFor(() => expect(submit()).toBeEnabled());
    expect(field.name()).toHaveValue('');
    expect(screen.queryByText(t('draftRestored'))).toBeNull();
  });

  it('is completable with the keyboard alone, in visual order', async () => {
    const { user } = renderForm();
    await user.tab();
    expect(field.name()).toHaveFocus();
    await user.tab();
    expect(field.email()).toHaveFocus();
    await user.tab();
    expect(field.message()).toHaveFocus();
    await user.tab();
    expect(submit()).toHaveFocus();
  });

  it('opts out of native validation so the server stays the single source of truth', () => {
    const { container } = renderForm();
    expect(container.querySelector('form')).toHaveAttribute('novalidate');
    expect(field.name()).toBeRequired();
    expect(field.message()).toBeRequired();
  });
});
