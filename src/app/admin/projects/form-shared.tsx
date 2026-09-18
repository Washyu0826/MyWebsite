'use client';

import Link from 'next/link';
import { useId, useRef, useState, useTransition, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { uploadFileAction, type FileManagerState } from '../files/actions';
import type { ProjectEditorState } from './actions';

export const initialState: ProjectEditorState = { ok: false, message: '' };

export const labelClass = 'grid gap-2 text-sm text-[var(--graphite)]';
export const inputClass = 'min-h-11 w-full border border-[var(--rule)] bg-[var(--paper)] px-3 py-2 text-base text-[var(--ink)]';
export const textareaClass = `${inputClass} font-mono text-sm leading-relaxed`;
export const legendClass = 'mb-4 text-lg font-semibold text-[var(--ink)]';
export const checkboxLabelClass = 'flex items-center gap-2 text-sm text-[var(--ink)]';
export const linkClass = 'text-[var(--indigo)] underline';

const imageAccept = 'image/png,image/jpeg,image/webp,image/gif';

function pad(value: number) {
  return String(value).padStart(2, '0');
}

/** ISO timestamp -> value for <input type="datetime-local"> in the browser's local time. */
export function toLocalDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** datetime-local value (browser local time) -> ISO timestamp for the server. */
export function fromLocalDateTimeInput(local: string): string {
  if (!local) return '';
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export function SubmitButton({ children, disabled = false, variant = 'primary', small = false }: {
  children: string; disabled?: boolean; variant?: 'primary' | 'danger'; small?: boolean;
}) {
  const { pending } = useFormStatus();
  const classes = ['admin-button', variant === 'danger' ? 'admin-button-danger' : '', small ? 'min-h-9! py-1!' : ''].join(' ');
  return <button className={classes} type="submit" disabled={pending || disabled}>
    {pending ? '處理中...' : children}
  </button>;
}

export function StatusMessage({ state, children }: { state: ProjectEditorState; children?: ReactNode }) {
  return <p className={state.ok ? 'admin-success' : 'admin-error'} role="status" aria-live="polite">
    {state.message}
    {state.message && children ? <> {children}</> : null}
  </p>;
}

/**
 * URL input with an optional "upload and fill" helper. The file input has no `name`, so it never
 * travels with the surrounding form; the upload goes through the shared file-manager action instead.
 */
export function UrlField({ label, name, value, onChange, prefix, upload = true, placeholder = 'https://...', hint }: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  /** Storage folder inside the `media` bucket, e.g. `projects/my-slug`. */
  prefix: string;
  /** Set to false for URLs that cannot be uploaded here (videos, external links). */
  upload?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  const fileId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<FileManagerState>({ ok: true, message: '' });
  const [pending, startUpload] = useTransition();

  function uploadSelected() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMessage({ ok: false, message: '請先選擇要上傳的圖片。' });
      return;
    }
    const formData = new FormData();
    formData.set('bucket', 'media');
    formData.set('prefix', prefix);
    formData.set('file', file);
    setMessage({ ok: true, message: '' });
    startUpload(async () => {
      try {
        const result = await uploadFileAction({ ok: false, message: '' }, formData);
        if (result.ok && result.publicUrl) {
          onChange(result.publicUrl);
          if (fileRef.current) fileRef.current.value = '';
          setMessage({ ok: true, message: '已上傳並填入網址，記得儲存專案。' });
        } else {
          setMessage({ ok: false, message: result.message || '上傳失敗。' });
        }
      } catch {
        setMessage({ ok: false, message: '上傳連線失敗，請確認 dev server 仍在執行，且檔案小於 8 MB。' });
      }
    });
  }

  return <div className="grid gap-2">
    <label className={labelClass}>
      <span>{label}</span>
      <input className={inputClass} name={name} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} autoComplete="off" inputMode="url" />
    </label>
    {hint ? <p className="text-xs text-[var(--graphite)]">{hint}</p> : null}
    {upload ? <div className="grid gap-2 text-xs text-[var(--graphite)]">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={fileId}>{label} 上傳檔案</label>
        <input id={fileId} ref={fileRef} className="min-h-9 max-w-full border border-[var(--rule)] bg-[var(--paper)] px-2 py-1 text-xs text-[var(--ink)]" type="file" accept={imageAccept} />
        <button className="admin-button min-h-9! py-1! text-xs" type="button" onClick={uploadSelected} disabled={pending}>
          {pending ? '上傳中...' : '上傳並填入網址'}
        </button>
        <Link className={linkClass} href="/admin/files" target="_blank">開啟檔案管理</Link>
      </div>
      <p className={message.ok ? 'admin-success' : 'admin-error'} role="status" aria-live="polite">{message.message}</p>
    </div> : null}
  </div>;
}
