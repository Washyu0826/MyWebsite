'use client';

import Link from 'next/link';
import { useId, useRef, useState, useTransition, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { newUploadAttempt, uploadAndPublish, type UploadAttempt } from '@/lib/assets/client';
import { AssetPicker } from '@/components/admin/asset-picker';
import type { FileManagerState } from '../files/actions';
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
 * travels with the surrounding form; Storage receives the file directly through the asset library.
 */
export function UrlField({ label, name, value, onChange, onMeta, upload = true, placeholder = 'https://...', hint }: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  /** Intrinsic size reported by the upload pipeline, so the row can store it alongside the URL. */
  onMeta?: (meta: { width: number; height: number } | null) => void;
  /** Legacy callers still supply a folder; the library now allocates opaque, immutable keys. */
  prefix: string;
  /** Set to false for URLs that cannot be uploaded here (videos, external links). */
  upload?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  const fileId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const attempt = useRef<{ file: File; value: UploadAttempt } | null>(null);
  const [message, setMessage] = useState<FileManagerState>({ ok: true, message: '' });
  const [pending, startUpload] = useTransition();

  function uploadSelected() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMessage({ ok: false, message: '請先選擇要上傳的圖片。' });
      return;
    }
    if (attempt.current?.file !== file) attempt.current = { file, value: newUploadAttempt() };
    const request = attempt.current.value;
    setMessage({ ok: true, message: '' });
    startUpload(async () => {
      try {
        const result = await uploadAndPublish(file, 'public', request, (percent, phase) => setMessage({ ok: true, message: `${phase} ${percent}%` }));
        if (result.public_url) {
          onChange(result.public_url);
          onMeta?.(result.imageMeta ?? null);
          if (fileRef.current) fileRef.current.value = '';
          setMessage({ ok: true, message: '已發布並填入網址，原始檔與版本已保留。' });
          attempt.current = null;
        } else {
          setMessage({ ok: false, message: '發布尚未完成，可重試。' });
        }
      } catch (error) {
        setMessage({ ok: false, message: error instanceof Error ? error.message : '上傳失敗，可重試。' });
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
          {pending ? '處理中...' : '上傳並建立公開網址'}
        </button>
        <AssetPicker onSelect={item => {
          onChange(item.public_url);
          onMeta?.(item.width && item.height ? { width: item.width, height: item.height } : null);
          setMessage({ ok: true, message: `已填入素材庫的「${item.name}」，記得儲存。` });
        }} />
        <Link className={linkClass} href="/admin/files" target="_blank">開啟檔案管理</Link>
      </div>
      <p className={message.ok ? 'admin-success' : 'admin-error'} role="status" aria-live="polite">{message.message}</p>
    </div> : null}
  </div>;
}
