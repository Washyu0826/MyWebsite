'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { Profile } from '@/types/content';
import { saveProfileAction, type ProfileEditorState } from './actions';

type Lang = 'zh' | 'en';
type FormValues = {
  name_zh: string; name_en: string; headline_zh: string; headline_en: string;
  now_zh: string; now_en: string; bio_zh: string; bio_en: string;
  location_zh: string; location_en: string; email: string;
  seo_description_zh: string; seo_description_en: string;
};

const initialState: ProfileEditorState = { ok: false, message: '' };

const labelClass = 'grid gap-2 text-sm text-[var(--graphite)]';
const inputClass = 'min-h-11 w-full border border-[var(--rule)] bg-[var(--paper)] px-3 py-2 text-base text-[var(--ink)]';
const textareaClass = `${inputClass} font-mono text-sm leading-relaxed`;
const legendClass = 'mb-4 text-lg font-semibold text-[var(--ink)]';

function valuesFromProfile(profile: Profile | null): FormValues {
  return {
    name_zh: profile?.name_zh || '',
    name_en: profile?.name_en || '',
    headline_zh: profile?.headline_zh || '',
    headline_en: profile?.headline_en || '',
    now_zh: profile?.now_zh || '',
    now_en: profile?.now_en || '',
    bio_zh: profile?.bio_zh || '',
    bio_en: profile?.bio_en || '',
    location_zh: profile?.location_zh || '',
    location_en: profile?.location_en || '',
    email: profile?.email || '',
    seo_description_zh: profile?.seo_description_zh || '',
    seo_description_en: profile?.seo_description_en || '',
  };
}

function SubmitButton({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return <button className="admin-button" type="submit" disabled={pending}>
    {pending ? '處理中...' : children}
  </button>;
}

export function ProfileForm({ profile }: { profile: Profile | null }) {
  const [state, formAction] = useActionState(saveProfileAction, initialState);
  const [values, setValues] = useState<FormValues>(() => valuesFromProfile(profile));

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues(current => ({ ...current, [key]: value }));
  }

  // Plain render helper (not a nested component) so inputs keep focus across re-renders.
  function renderLangFields(lang: Lang) {
    const title = lang === 'zh' ? '中文' : 'English';
    return <fieldset className="grid gap-5">
      <legend className={legendClass}>{title} 內容</legend>
      <label className={labelClass}>
        <span>姓名（{title}）</span>
        <input className={inputClass} name={`name_${lang}`} value={values[`name_${lang}`]} onChange={event => update(`name_${lang}`, event.target.value)} maxLength={120} autoComplete="off" />
      </label>
      <label className={labelClass}>
        <span>定位句（{title}，首頁大字下一行）</span>
        <input className={inputClass} name={`headline_${lang}`} value={values[`headline_${lang}`]} onChange={event => update(`headline_${lang}`, event.target.value)} maxLength={200} />
      </label>
      <label className={labelClass}>
        <span>目前狀態（{title}，首頁「目前」狀態列）</span>
        <input className={inputClass} name={`now_${lang}`} value={values[`now_${lang}`]} onChange={event => update(`now_${lang}`, event.target.value)} maxLength={300} />
      </label>
      <label className={labelClass}>
        <span>所在地（{title}）</span>
        <input className={inputClass} name={`location_${lang}`} value={values[`location_${lang}`]} onChange={event => update(`location_${lang}`, event.target.value)} maxLength={120} />
      </label>
      <label className={labelClass}>
        <span>SEO 描述（{title}，建議 80 到 160 字）</span>
        <textarea className={textareaClass} name={`seo_description_${lang}`} rows={3} value={values[`seo_description_${lang}`]} onChange={event => update(`seo_description_${lang}`, event.target.value)} maxLength={320} />
      </label>
      <label className={labelClass}>
        <span>自介（{title}，Markdown）</span>
        <textarea className={textareaClass} name={`bio_${lang}`} rows={14} value={values[`bio_${lang}`]} onChange={event => update(`bio_${lang}`, event.target.value)} spellCheck={false} />
      </label>
    </fieldset>;
  }

  return <form className="grid gap-10" action={formAction}>
    <fieldset className="grid gap-5 md:grid-cols-2">
      <legend className={legendClass}>聯絡資訊</legend>
      <label className={labelClass}>
        <span>Email（聯絡頁與 mailto 連結會使用）</span>
        <input className={inputClass} name="email" type="email" value={values.email} onChange={event => update('email', event.target.value)} maxLength={254} autoComplete="off" inputMode="email" />
      </label>
    </fieldset>

    <div className="grid gap-8 lg:grid-cols-2">
      {renderLangFields('zh')}
      {renderLangFields('en')}
    </div>

    <div className="grid gap-3 border-t border-[var(--rule)] pt-6">
      <p className="text-sm text-[var(--graphite)]">至少需要一種語言的姓名。儲存後首頁與聯絡頁會立即更新。</p>
      <SubmitButton>儲存個人資料</SubmitButton>
      <p className={state.ok ? 'admin-success' : 'admin-error'} role="status" aria-live="polite">{state.message}</p>
    </div>
  </form>;
}
