'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { SocialLink } from '@/types/content';
import { ReorderList, type ReorderResult } from '../reorder-list';
import {
  createSocialLinkAction, deleteSocialLinkAction, updateSocialLinkAction, type SocialLinkState,
} from './actions';

type FormValues = { platform: string; label: string; url: string; sort_order: string; is_visible: boolean };

const initialState: SocialLinkState = { ok: false, message: '' };
const emptyValues: FormValues = { platform: '', label: '', url: '', sort_order: '0', is_visible: true };
const platformSuggestions = ['github', 'linkedin', 'email', 'phone', 'line', 'instagram', 'x', 'threads', 'medium', 'facebook', 'youtube', 'website'];
const platformListId = 'social-platform-suggestions';

const labelClass = 'grid gap-2 text-sm text-[var(--graphite)]';
const checkboxLabelClass = 'flex min-h-11 items-center gap-2 text-sm text-[var(--ink)]';
const inputClass = 'min-h-11 w-full border border-[var(--rule)] bg-[var(--paper)] px-3 py-2 text-base text-[var(--ink)]';

function valuesFromLink(link: SocialLink): FormValues {
  return {
    platform: link.platform,
    label: link.label,
    url: link.url,
    sort_order: String(link.sort_order),
    is_visible: link.is_visible,
  };
}

function SubmitButton({ children, disabled = false, variant = 'primary' }: { children: string; disabled?: boolean; variant?: 'primary' | 'danger' }) {
  const { pending } = useFormStatus();
  return <button className={`admin-button ${variant === 'danger' ? 'admin-button-danger' : ''}`} type="submit" disabled={pending || disabled}>
    {pending ? '處理中...' : children}
  </button>;
}

function StatusMessage({ state }: { state: SocialLinkState }) {
  return <p className={state.ok ? 'admin-success' : 'admin-error'} role="status" aria-live="polite">{state.message}</p>;
}

function LinkFields({ values, update, idPrefix }: {
  values: FormValues;
  update: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void;
  idPrefix: string;
}) {
  return <div className="grid gap-4 md:grid-cols-2">
    <label className={labelClass} htmlFor={`${idPrefix}-platform`}>
      <span>平台代號（小寫英文，例如 github、linkedin、email、x）</span>
      <input id={`${idPrefix}-platform`} className={inputClass} name="platform" list={platformListId} value={values.platform} onChange={event => update('platform', event.target.value)} maxLength={40} autoComplete="off" required />
    </label>
    <label className={labelClass} htmlFor={`${idPrefix}-label`}>
      <span>顯示名稱（選填，例如 GitHub、LinkedIn）</span>
      <input id={`${idPrefix}-label`} className={inputClass} name="label" value={values.label} onChange={event => update('label', event.target.value)} maxLength={80} autoComplete="off" />
    </label>
    <label className={`${labelClass} md:col-span-2`} htmlFor={`${idPrefix}-url`}>
      <span>連結（http(s) 網址、mailto:you@example.com 或 tel:+886912345678；LINE 請用 https://line.me/ti/p/~你的ID）</span>
      <input id={`${idPrefix}-url`} className={inputClass} name="url" value={values.url} onChange={event => update('url', event.target.value)} placeholder="https://github.com/your-handle" autoComplete="off" inputMode="url" required />
    </label>
    <label className={labelClass} htmlFor={`${idPrefix}-sort`}>
      <span>排序（數字越小越前面）</span>
      <input id={`${idPrefix}-sort`} className={inputClass} name="sort_order" type="number" step={1} inputMode="numeric" value={values.sort_order} onChange={event => update('sort_order', event.target.value)} />
    </label>
    <label className={checkboxLabelClass} htmlFor={`${idPrefix}-visible`}>
      <input id={`${idPrefix}-visible`} type="checkbox" name="is_visible" checked={values.is_visible} onChange={event => update('is_visible', event.target.checked)} />
      <span>公開顯示</span>
    </label>
  </div>;
}

export function PlatformSuggestions() {
  return <datalist id={platformListId}>
    {platformSuggestions.map(platform => <option key={platform} value={platform} />)}
  </datalist>;
}

/** Writes the new positions through the unchanged updateSocialLinkAction, one row per call. */
export function ReorderSocialLinks({ links }: { links: SocialLink[] }) {
  const router = useRouter();

  async function save(ids: string[]): Promise<ReorderResult> {
    const byId = new Map(links.map(link => [link.id, link]));
    for (const [index, id] of ids.entries()) {
      const link = byId.get(id);
      if (!link || link.sort_order === index) continue;
      const data = new FormData();
      data.set('id', link.id);
      data.set('platform', link.platform);
      data.set('label', link.label || '');
      data.set('url', link.url);
      data.set('sort_order', String(index));
      // Checkboxes only reach a Server Action when they are checked.
      if (link.is_visible) data.set('is_visible', 'on');
      const result = await updateSocialLinkAction(initialState, data);
      if (!result.ok) return { ok: false, message: `第 ${index + 1} 筆儲存失敗：${result.message}` };
    }
    router.refresh();
    return { ok: true, message: '連結排序已儲存。' };
  }

  return <ReorderList itemNoun="連結" onSave={save} hint="首頁與聯絡頁會依這個順序顯示。"
    rows={links.map(link => ({
      id: link.id,
      label: link.label || link.platform,
      meta: `${link.platform} · ${link.is_visible ? '公開' : '隱藏'}`,
    }))} />;
}

export function AddSocialLinkForm() {
  const [state, formAction] = useActionState(createSocialLinkAction, initialState);
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [handledState, setHandledState] = useState<SocialLinkState>(initialState);

  // Reset the inputs once after each successful create (state adjustment during render, no effect needed).
  if (state !== handledState) {
    setHandledState(state);
    if (state.ok) setValues(emptyValues);
  }

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues(current => ({ ...current, [key]: value }));
  }

  return <form className="grid gap-4" action={formAction}>
    <LinkFields values={values} update={update} idPrefix="social-new" />
    <SubmitButton>新增連結</SubmitButton>
    <StatusMessage state={state} />
  </form>;
}

export function SocialLinkItem({ link }: { link: SocialLink }) {
  const [state, formAction] = useActionState(updateSocialLinkAction, initialState);
  const [deleteState, deleteAction] = useActionState(deleteSocialLinkAction, initialState);
  const [values, setValues] = useState<FormValues>(() => valuesFromLink(link));
  const [confirmed, setConfirmed] = useState(false);
  const deleted = deleteState.ok;
  const headingId = `social-link-${link.id}`;

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues(current => ({ ...current, [key]: value }));
  }

  return <article className="grid gap-5 border border-[var(--rule)] p-4" aria-labelledby={headingId}>
    <h3 id={headingId} className="text-base font-semibold">
      {link.label || link.platform}
      {' '}<span className="text-sm font-normal text-[var(--graphite)]">{link.platform} · {link.is_visible ? '公開' : '隱藏'}</span>
    </h3>

    {deleted ? <StatusMessage state={deleteState} /> : <>
      <form className="grid gap-4" action={formAction}>
        <input type="hidden" name="id" value={link.id} />
        <LinkFields values={values} update={update} idPrefix={`social-${link.id}`} />
        <SubmitButton>儲存變更</SubmitButton>
        <StatusMessage state={state} />
      </form>

      <form className="grid gap-3 border-t border-[var(--rule)] pt-4" action={deleteAction}>
        <input type="hidden" name="id" value={link.id} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="confirm" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required />
          <span>我確定要刪除這個連結</span>
        </label>
        <SubmitButton variant="danger" disabled={!confirmed}>刪除連結</SubmitButton>
        <StatusMessage state={deleteState} />
      </form>
    </>}
  </article>;
}
