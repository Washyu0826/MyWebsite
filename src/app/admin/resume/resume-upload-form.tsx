'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { uploadResumeAction, type ResumeUploadState } from './actions';

const initialState: ResumeUploadState = { ok: false, message: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="admin-button" type="submit" disabled={pending}>
    {pending ? '上傳中...' : '更新履歷'}
  </button>;
}

export function ResumeUploadForm() {
  const [state, formAction] = useActionState(uploadResumeAction, initialState);
  return <form className="admin-form" action={formAction}>
    <label>
      <span>管理密碼</span>
      <input name="token" type="password" autoComplete="current-password" required />
    </label>
    <label>
      <span>履歷語言</span>
      <select name="locale" defaultValue="zh" required>
        <option value="zh">中文履歷</option>
        <option value="en">English resume</option>
      </select>
    </label>
    <label>
      <span>PDF 檔案</span>
      <input name="file" type="file" accept="application/pdf" required />
    </label>
    <SubmitButton />
    {state.message && <p className={state.ok ? 'admin-success' : 'admin-error'} role="status">{state.message}</p>}
  </form>;
}
