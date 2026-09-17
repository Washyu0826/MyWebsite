'use client';

import { useActionState, useState, type FormEvent } from 'react';
import { useFormStatus } from 'react-dom';
import {
  deleteFileAction,
  uploadFileAction,
  type FileManagerState,
} from './actions';
import type { StorageBucket } from './storage-config';

const initialState: FileManagerState = { ok: false, message: '' };

function SubmitButton({ children, variant = 'primary' }: { children: string; variant?: 'primary' | 'danger' }) {
  const { pending } = useFormStatus();
  return <button className={`admin-button ${variant === 'danger' ? 'admin-button-danger' : ''}`} type="submit" disabled={pending}>
    {pending ? '處理中...' : children}
  </button>;
}

function StatusMessage({ state }: { state: FileManagerState }) {
  if (!state.message) return null;
  return <p className={state.ok ? 'admin-success' : 'admin-error'} role="status">
    {state.message}
    {state.publicUrl ? <>
      {' '}
      <a href={state.publicUrl} target="_blank" rel="noreferrer">開啟檔案</a>
    </> : null}
  </p>;
}

export function UploadFileForm({ bucket, prefix }: { bucket: StorageBucket; prefix: string }) {
  const [state, formAction] = useActionState(uploadFileAction, initialState);

  return <form className="admin-form" action={formAction}>
    <input type="hidden" name="bucket" value={bucket} />
    <input type="hidden" name="prefix" value={prefix} />
    <label>
      <span>管理密碼</span>
      <input name="token" type="password" autoComplete="current-password" required />
    </label>
    <label>
      <span>檔案</span>
      <input name="file" type="file" accept={bucket === 'resume' ? 'application/pdf' : 'image/png,image/jpeg,image/webp,image/svg+xml,image/gif'} required />
    </label>
    <SubmitButton>上傳檔案</SubmitButton>
    <StatusMessage state={state} />
  </form>;
}

export function ProfilePhotoForm() {
  const [state, setState] = useState<FileManagerState>(initialState);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setState(initialState);

    try {
      const response = await fetch('/admin/files/profile-photo', {
        method: 'POST',
        body: new FormData(event.currentTarget),
      });
      const result = await response.json() as FileManagerState;
      setState(result);
    } catch {
      setState({ ok: false, message: '上傳連線失敗。請確認 dev server 還在執行，並且照片小於 8 MB。' });
    } finally {
      setPending(false);
    }
  }

  return <form className="admin-form" onSubmit={onSubmit}>
    <label>
      <span>管理密碼</span>
      <input name="token" type="password" autoComplete="current-password" required />
    </label>
    <label>
      <span>個人照</span>
      <input name="file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" required />
    </label>
    <button className="admin-button" type="submit" disabled={pending}>
      {pending ? '處理中...' : '更新個人照'}
    </button>
    <StatusMessage state={state} />
  </form>;
}

export function DeleteFileForm({ bucket, path }: { bucket: StorageBucket; path: string }) {
  const [state, formAction] = useActionState(deleteFileAction, initialState);

  return <form className="admin-inline-form" action={formAction}>
    <input type="hidden" name="bucket" value={bucket} />
    <input type="hidden" name="path" value={path} />
    <input className="admin-token-input" name="token" type="password" placeholder="管理密碼" aria-label="管理密碼" autoComplete="current-password" required />
    <SubmitButton variant="danger">刪除</SubmitButton>
    <StatusMessage state={state} />
  </form>;
}
