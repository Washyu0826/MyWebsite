'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { Experience } from '@/types/content';
import { experienceKindLabels, experienceKinds, type ExperienceKind } from '../profile/validation';
import { deleteExperienceAction, saveExperienceAction, type ExperienceEditorState } from './actions';

type FormValues = {
  kind: ExperienceKind; org_zh: string; org_en: string; role_zh: string; role_en: string;
  description_zh: string; description_en: string; start_date: string; end_date: string;
  is_current: boolean; url: string; sort_order: string; is_visible: boolean;
};

const initialState: ExperienceEditorState = { ok: false, message: '' };

const labelClass = 'grid gap-2 text-sm text-[var(--graphite)]';
const checkboxLabelClass = 'flex min-h-11 items-center gap-2 text-sm text-[var(--ink)]';
const inputClass = 'min-h-11 w-full border border-[var(--rule)] bg-[var(--paper)] px-3 py-2 text-base text-[var(--ink)] disabled:opacity-50';
const textareaClass = `${inputClass} font-mono text-sm leading-relaxed`;
const legendClass = 'mb-4 text-lg font-semibold text-[var(--ink)]';

function valuesFromExperience(experience: Experience | null): FormValues {
  return {
    kind: experience?.kind || 'work',
    org_zh: experience?.org_zh || '',
    org_en: experience?.org_en || '',
    role_zh: experience?.role_zh || '',
    role_en: experience?.role_en || '',
    description_zh: experience?.description_zh || '',
    description_en: experience?.description_en || '',
    start_date: experience?.start_date || '',
    end_date: experience?.end_date || '',
    is_current: experience?.is_current || false,
    url: experience?.url || '',
    sort_order: experience ? String(experience.sort_order) : '0',
    is_visible: experience ? experience.is_visible : true,
  };
}

function SubmitButton({ children, disabled = false, variant = 'primary' }: { children: string; disabled?: boolean; variant?: 'primary' | 'danger' }) {
  const { pending } = useFormStatus();
  return <button className={`admin-button ${variant === 'danger' ? 'admin-button-danger' : ''}`} type="submit" disabled={pending || disabled}>
    {pending ? '處理中...' : children}
  </button>;
}

function StatusMessage({ state, children }: { state: ExperienceEditorState; children?: React.ReactNode }) {
  return <p className={state.ok ? 'admin-success' : 'admin-error'} role="status" aria-live="polite">
    {state.message}
    {state.message && children ? <> {children}</> : null}
  </p>;
}

export function ExperienceForm({ experience }: { experience: Experience | null }) {
  const [state, formAction] = useActionState(saveExperienceAction, initialState);
  const [values, setValues] = useState<FormValues>(() => valuesFromExperience(experience));
  const created = state.ok && !experience;

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues(current => ({ ...current, [key]: value }));
  }

  function toggleCurrent(checked: boolean) {
    setValues(current => ({ ...current, is_current: checked, end_date: checked ? '' : current.end_date }));
  }

  return <form className="grid gap-10" action={formAction}>
    {experience ? <input type="hidden" name="id" value={experience.id} /> : null}

    <fieldset className="grid gap-5 md:grid-cols-2">
      <legend className={legendClass}>基本設定</legend>
      <label className={labelClass}>
        <span>類型</span>
        <select className={inputClass} name="kind" value={values.kind} onChange={event => update('kind', event.target.value as ExperienceKind)}>
          {experienceKinds.map(kind => <option key={kind} value={kind}>{experienceKindLabels[kind]}</option>)}
        </select>
      </label>
      <label className={labelClass}>
        <span>排序（數字越小越前面）</span>
        <input className={inputClass} name="sort_order" type="number" step={1} inputMode="numeric" value={values.sort_order} onChange={event => update('sort_order', event.target.value)} />
      </label>
      <label className={labelClass}>
        <span>開始日期（必填）</span>
        <input className={inputClass} name="start_date" type="date" value={values.start_date} onChange={event => update('start_date', event.target.value)} required />
      </label>
      <label className={labelClass}>
        <span>結束日期（勾選「目前進行中」時會清空並停用）</span>
        <input className={inputClass} name="end_date" type="date" value={values.end_date} onChange={event => update('end_date', event.target.value)} disabled={values.is_current} aria-disabled={values.is_current} />
      </label>
      <label className={checkboxLabelClass}>
        <input type="checkbox" name="is_current" checked={values.is_current} onChange={event => toggleCurrent(event.target.checked)} />
        <span>目前進行中（公開頁顯示「至今」）</span>
      </label>
      <label className={checkboxLabelClass}>
        <input type="checkbox" name="is_visible" checked={values.is_visible} onChange={event => update('is_visible', event.target.checked)} />
        <span>公開顯示</span>
      </label>
      <label className={`${labelClass} md:col-span-2`}>
        <span>相關連結（選填，http(s) 網址）</span>
        <input className={inputClass} name="url" type="url" value={values.url} onChange={event => update('url', event.target.value)} placeholder="https://..." autoComplete="off" />
      </label>
    </fieldset>

    <div className="grid gap-8 lg:grid-cols-2">
      <fieldset className="grid gap-5">
        <legend className={legendClass}>中文內容</legend>
        <label className={labelClass}>
          <span>單位／學校（中文）</span>
          <input className={inputClass} name="org_zh" value={values.org_zh} onChange={event => update('org_zh', event.target.value)} maxLength={160} />
        </label>
        <label className={labelClass}>
          <span>職稱／身分（中文）</span>
          <input className={inputClass} name="role_zh" value={values.role_zh} onChange={event => update('role_zh', event.target.value)} maxLength={160} />
        </label>
        <label className={labelClass}>
          <span>說明（中文，Markdown，建議條列）</span>
          <textarea className={textareaClass} name="description_zh" rows={10} value={values.description_zh} onChange={event => update('description_zh', event.target.value)} spellCheck={false} />
        </label>
      </fieldset>

      <fieldset className="grid gap-5">
        <legend className={legendClass}>English 內容</legend>
        <label className={labelClass}>
          <span>單位／學校（English）</span>
          <input className={inputClass} name="org_en" value={values.org_en} onChange={event => update('org_en', event.target.value)} maxLength={160} />
        </label>
        <label className={labelClass}>
          <span>職稱／身分（English）</span>
          <input className={inputClass} name="role_en" value={values.role_en} onChange={event => update('role_en', event.target.value)} maxLength={160} />
        </label>
        <label className={labelClass}>
          <span>說明（English，Markdown）</span>
          <textarea className={textareaClass} name="description_en" rows={10} value={values.description_en} onChange={event => update('description_en', event.target.value)} spellCheck={false} />
        </label>
      </fieldset>
    </div>

    <div className="grid gap-3 border-t border-[var(--rule)] pt-6">
      <p className="text-sm text-[var(--graphite)]">至少需要一種語言的單位名稱與開始日期；中文單位留空時會沿用英文。</p>
      <SubmitButton disabled={created}>{experience ? '儲存經歷' : '建立經歷'}</SubmitButton>
      <StatusMessage state={state}>
        {state.ok ? <>
          <Link className="text-[var(--indigo)] underline" href="/admin/experiences">回到經歷列表</Link>
          {created && state.id ? <>{' '}<Link className="text-[var(--indigo)] underline" href={`/admin/experiences/${state.id}`}>繼續編輯這筆</Link></> : null}
          {created ? <>{' '}<Link className="text-[var(--indigo)] underline" href="/admin/experiences/new">再新增一筆</Link></> : null}
        </> : null}
      </StatusMessage>
      {created ? <p className="text-sm text-[var(--graphite)]">經歷已建立。若要繼續修改，請從列表或上方連結進入編輯頁，以免重複建立。</p> : null}
    </div>
  </form>;
}

export function DeleteExperienceForm({ id, label }: { id: string; label: string }) {
  const [state, formAction] = useActionState(deleteExperienceAction, initialState);
  const [confirmed, setConfirmed] = useState(false);

  return <form className="grid gap-4" action={formAction}>
    <input type="hidden" name="id" value={id} />
    <p className="text-sm text-[var(--graphite)]">刪除後無法復原，首頁的經歷區塊會立即移除「{label}」。</p>
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name="confirm" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required disabled={state.ok} />
      <span>我確定要刪除這筆經歷</span>
    </label>
    <SubmitButton variant="danger" disabled={!confirmed || state.ok}>刪除經歷</SubmitButton>
    <StatusMessage state={state}>
      {state.ok ? <Link className="text-[var(--indigo)] underline" href="/admin/experiences">回到經歷列表</Link> : null}
    </StatusMessage>
  </form>;
}
