'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState, useTransition } from 'react';
import type { ContentStatus, Project } from '@/types/content';
import type { TranslateLang } from '@/lib/ai/translate';
import { MarkdownField } from '../markdown-preview';
import { DirtyBadge, useUnsavedChanges } from '../unsaved-changes';
import { deleteProjectAction, saveProjectAction } from './actions';
import {
  projectFieldLabels, projectTagLabels, projectTags, projectTextKeys, slugify, statusLabels, statusValues,
  type ProjectTag, type ProjectTextKey,
} from './fields';
import {
  checkboxLabelClass, fromLocalDateTimeInput, initialState, inputClass, labelClass, legendClass, linkClass,
  StatusMessage, SubmitButton, textareaClass, toLocalDateTimeInput, UrlField,
} from './form-shared';
import { translateProjectAction } from './translate-action';

type BilingualKey = `${ProjectTextKey}_${TranslateLang}`;

type FormValues = Record<BilingualKey, string> & {
  slug: string;
  tech_stack: string;
  tags: ProjectTag[];
  cover_url: string;
  architecture_url: string;
  video_url: string;
  team_size: string;
  period_start: string;
  period_end: string;
  demo_url: string;
  repo_url: string;
  status: ContentStatus;
  publishedAtLocal: string;
  is_featured: boolean;
  sort_order: string;
};

function valuesFromProject(project: Project | null): FormValues {
  const text = {} as Record<BilingualKey, string>;
  for (const key of projectTextKeys) {
    text[`${key}_zh`] = project?.[`${key}_zh`] || '';
    text[`${key}_en`] = project?.[`${key}_en`] || '';
  }
  return {
    ...text,
    slug: project?.slug || '',
    tech_stack: (project?.tech_stack || []).join(', '),
    tags: (project?.tags || []).filter((tag): tag is ProjectTag => (projectTags as readonly string[]).includes(tag)),
    cover_url: project?.cover_url || '',
    architecture_url: project?.architecture_url || '',
    video_url: project?.video_url || '',
    team_size: project?.team_size ? String(project.team_size) : '',
    period_start: project?.period_start || '',
    period_end: project?.period_end || '',
    demo_url: project?.demo_url || '',
    repo_url: project?.repo_url || '',
    status: project?.status || 'draft',
    publishedAtLocal: '',
    is_featured: project?.is_featured ?? false,
    sort_order: project ? String(project.sort_order) : '0',
  };
}

const caseStudyKeys: { key: ProjectTextKey; rows: number; hint: string }[] = [
  { key: 'problem', rows: 6, hint: '背景與要解決的問題' },
  { key: 'solution', rows: 8, hint: '做法、架構與取捨' },
  { key: 'outcome', rows: 6, hint: '可驗證的結果，量化數字放在下方「量化成果」' },
  { key: 'contribution', rows: 6, hint: '自己負責的模組與決策' },
  { key: 'body', rows: 16, hint: '實作細節，可放程式碼區塊' },
];

function BilingualColumn({ lang, values, update }: {
  lang: TranslateLang;
  values: FormValues;
  update: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void;
}) {
  const name = lang === 'zh' ? '中文' : 'English';
  return <fieldset className="grid gap-5">
    <legend className={legendClass}>{name} 案例研究</legend>
    {caseStudyKeys.map(({ key, rows, hint }) => {
      const field: BilingualKey = `${key}_${lang}`;
      const label = <label key={field} className={labelClass}>
        <span>{projectFieldLabels[key]}（{name}，Markdown）<span className="block text-xs">{hint}</span></span>
        <textarea className={textareaClass} name={field} rows={rows} value={values[field]} onChange={event => update(field, event.target.value)} spellCheck={false} />
      </label>;
      // The long-form body is the one that earns a preview; the short sections stay single-column.
      if (key !== 'body') return label;
      return <MarkdownField key={field} value={values[field]} label={`${projectFieldLabels[key]}（${name}）`}>{label}</MarkdownField>;
    })}
  </fieldset>;
}

export function ProjectForm({ project }: { project: Project | null }) {
  const [state, formAction] = useActionState(saveProjectAction, initialState);
  const [values, setValues] = useState<FormValues>(() => valuesFromProject(project));
  // Everything the user has not yet sent to the server is measured against this snapshot.
  const [baseline, setBaseline] = useState<FormValues>(() => valuesFromProject(project));
  const [handledState, setHandledState] = useState(initialState);
  const [overwrite, setOverwrite] = useState(false);
  const [translateMessage, setTranslateMessage] = useState<{ ok: boolean; text: string }>({ ok: true, text: '' });
  const [translating, setTranslating] = useState<TranslateLang | null>(null);
  const [translatePending, startTranslate] = useTransition();
  const defaultPublishedAt = project?.published_at || null;

  // Local-time conversion depends on the browser's timezone, so it runs after hydration.
  // The baseline moves with it, otherwise the form would look dirty before the user typed anything.
  useEffect(() => {
    const local = toLocalDateTimeInput(defaultPublishedAt);
    setValues(current => ({ ...current, publishedAtLocal: local }));
    setBaseline(current => ({ ...current, publishedAtLocal: local }));
  }, [defaultPublishedAt]);

  // A fresh state object arrives once per submit (state adjustment during render, no effect needed).
  if (state !== handledState) {
    setHandledState(state);
    if (state.ok) setBaseline(values);
  }

  const dirty = JSON.stringify(values) !== JSON.stringify(baseline);
  useUnsavedChanges(dirty);

  const created = state.ok && !project;
  const uploadPrefix = `projects/${slugify(values.slug || values.title_en || values.title_zh) || 'untitled'}`;

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues(current => ({ ...current, [key]: value }));
  }

  function toggleTag(tag: ProjectTag, checked: boolean) {
    setValues(current => ({
      ...current,
      tags: projectTags.filter(item => item === tag ? checked : current.tags.includes(item)),
    }));
  }

  function translate(to: TranslateLang) {
    const from: TranslateLang = to === 'zh' ? 'en' : 'zh';
    const source: Partial<Record<ProjectTextKey, string>> = {};
    let hasContent = false;
    for (const key of projectTextKeys) {
      source[key] = values[`${key}_${from}`];
      if (source[key]?.trim()) hasContent = true;
    }
    if (!hasContent) {
      setTranslateMessage({ ok: false, text: from === 'zh' ? '中文欄位是空的，沒有內容可以翻譯。' : 'English 欄位是空的，沒有內容可以翻譯。' });
      return;
    }
    setTranslating(to);
    setTranslateMessage({ ok: true, text: '' });
    startTranslate(async () => {
      const result = await translateProjectAction({ from, to, fields: source });
      setTranslating(null);
      if (!result.ok) {
        setTranslateMessage({ ok: false, text: result.message });
        return;
      }
      const skipped: string[] = [];
      setValues(current => {
        const next = { ...current };
        for (const key of projectTextKeys) {
          const target: BilingualKey = `${key}_${to}`;
          if (!result.data[key]) continue;
          if (overwrite || !current[target].trim()) next[target] = result.data[key];
          else skipped.push(projectFieldLabels[key]);
        }
        return next;
      });
      const targetName = to === 'zh' ? '中文' : 'English';
      setTranslateMessage({
        ok: true,
        text: skipped.length
          ? `已填入 ${targetName} 翻譯草稿；${skipped.join('、')}已有內容所以未覆蓋（勾選「覆蓋現有內容」可強制覆蓋）。請檢查後再儲存。`
          : `已填入 ${targetName} 翻譯草稿，請檢查內容後再儲存。`,
      });
    });
  }

  return <form className="grid gap-10" action={formAction}>
    {project ? <input type="hidden" name="id" value={project.id} /> : null}
    <input type="hidden" name="published_at" value={fromLocalDateTimeInput(values.publishedAtLocal)} />

    <fieldset className="grid gap-5">
      <legend className={legendClass}>基本</legend>
      <label className={labelClass}>
        <span>Slug（網址用，英文小寫與連字號；留空時會從標題自動產生）</span>
        <input className={inputClass} name="slug" value={values.slug} onChange={event => update('slug', event.target.value)} placeholder="document-search" autoComplete="off" />
      </label>
      <div className="grid gap-5 lg:grid-cols-2">
        <label className={labelClass}>
          <span>標題（中文）</span>
          <input className={inputClass} name="title_zh" value={values.title_zh} onChange={event => update('title_zh', event.target.value)} maxLength={200} />
        </label>
        <label className={labelClass}>
          <span>標題（English）</span>
          <input className={inputClass} name="title_en" value={values.title_en} onChange={event => update('title_en', event.target.value)} maxLength={200} />
        </label>
        <label className={labelClass}>
          <span>摘要（中文，一句話，列表用）</span>
          <textarea className={textareaClass} name="summary_zh" rows={2} value={values.summary_zh} onChange={event => update('summary_zh', event.target.value)} maxLength={500} />
        </label>
        <label className={labelClass}>
          <span>摘要（English）</span>
          <textarea className={textareaClass} name="summary_en" rows={2} value={values.summary_en} onChange={event => update('summary_en', event.target.value)} maxLength={500} />
        </label>
      </div>
      <fieldset className="grid gap-2">
        <legend className="text-sm text-[var(--graphite)]">分類標籤（篩選用）</legend>
        <div className="flex flex-wrap gap-4">
          {projectTags.map(tag => <label key={tag} className={checkboxLabelClass}>
            <input type="checkbox" name="tags" value={tag} checked={values.tags.includes(tag)} onChange={event => toggleTag(tag, event.target.checked)} />
            <span>{projectTagLabels[tag]}<span className="text-xs text-[var(--graphite)]">（{tag}）</span></span>
          </label>)}
        </div>
      </fieldset>
      <label className={labelClass}>
        <span>技術堆疊（以逗號分隔，最多 30 項）</span>
        <input className={inputClass} name="tech_stack" value={values.tech_stack} onChange={event => update('tech_stack', event.target.value)} placeholder="Next.js, TypeScript, PostgreSQL" autoComplete="off" />
      </label>
    </fieldset>

    <section className="grid gap-4 border-t border-[var(--rule)] pt-6" aria-labelledby="ai-translate-heading">
      <h2 id="ai-translate-heading" className="text-lg font-semibold">AI 翻譯</h2>
      <p className="text-sm text-[var(--graphite)]">
        用 Claude 把標題、摘要、案例研究、替代文字與角色翻譯到另一種語言，只會填入表單欄位作為草稿，不會自動儲存。請務必人工校對後再按「儲存專案」。
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <button className="admin-button" type="button" onClick={() => translate('en')} disabled={translatePending}>
          {translatePending && translating === 'en' ? '翻譯中...' : '用 AI 翻譯成英文'}
        </button>
        <button className="admin-button" type="button" onClick={() => translate('zh')} disabled={translatePending}>
          {translatePending && translating === 'zh' ? '翻譯中...' : '用 AI 翻譯成中文'}
        </button>
        <label className={checkboxLabelClass}>
          <input type="checkbox" checked={overwrite} onChange={event => setOverwrite(event.target.checked)} />
          <span>覆蓋現有內容</span>
        </label>
      </div>
      <p className={translateMessage.ok ? 'admin-success' : 'admin-error'} role="status" aria-live="polite">
        {translatePending ? '正在呼叫 Claude 翻譯，長文可能需要一到兩分鐘...' : translateMessage.text}
      </p>
    </section>

    <section className="grid gap-4 border-t border-[var(--rule)] pt-6" aria-labelledby="case-study-heading">
      <h2 id="case-study-heading" className="text-lg font-semibold">案例研究</h2>
      <div className="grid gap-8 lg:grid-cols-2">
        <BilingualColumn lang="zh" values={values} update={update} />
        <BilingualColumn lang="en" values={values} update={update} />
      </div>
    </section>

    <fieldset className="grid gap-5 border-t border-[var(--rule)] pt-6">
      <legend className={legendClass}>視覺</legend>
      <div className="grid gap-5">
        <UrlField label="封面圖片 URL" name="cover_url" value={values.cover_url} onChange={value => update('cover_url', value)} prefix={uploadPrefix} hint="建議 16:9，列表與詳情頁共用。可直接上傳 PNG / JPG / WebP / GIF（8 MB 內）。" />
        <div className="grid gap-5 lg:grid-cols-2">
          <label className={labelClass}>
            <span>封面替代文字（中文）</span>
            <input className={inputClass} name="cover_alt_zh" value={values.cover_alt_zh} onChange={event => update('cover_alt_zh', event.target.value)} maxLength={300} />
          </label>
          <label className={labelClass}>
            <span>封面替代文字（English）</span>
            <input className={inputClass} name="cover_alt_en" value={values.cover_alt_en} onChange={event => update('cover_alt_en', event.target.value)} maxLength={300} />
          </label>
        </div>
        <UrlField label="架構圖 URL" name="architecture_url" value={values.architecture_url} onChange={value => update('architecture_url', value)} prefix={uploadPrefix} />
        <div className="grid gap-5 lg:grid-cols-2">
          <label className={labelClass}>
            <span>架構圖替代文字（中文）</span>
            <input className={inputClass} name="architecture_alt_zh" value={values.architecture_alt_zh} onChange={event => update('architecture_alt_zh', event.target.value)} maxLength={300} />
          </label>
          <label className={labelClass}>
            <span>架構圖替代文字（English）</span>
            <input className={inputClass} name="architecture_alt_en" value={values.architecture_alt_en} onChange={event => update('architecture_alt_en', event.target.value)} maxLength={300} />
          </label>
        </div>
        <UrlField label="影片 URL（YouTube 或 mp4 連結）" name="video_url" value={values.video_url} onChange={value => update('video_url', value)} prefix={uploadPrefix} upload={false} />
      </div>
    </fieldset>

    <fieldset className="grid gap-5 border-t border-[var(--rule)] pt-6">
      <legend className={legendClass}>資訊欄</legend>
      <div className="grid gap-5 lg:grid-cols-2">
        <label className={labelClass}>
          <span>角色（中文）</span>
          <input className={inputClass} name="role_zh" value={values.role_zh} onChange={event => update('role_zh', event.target.value)} maxLength={100} placeholder="全端開發" />
        </label>
        <label className={labelClass}>
          <span>角色（English）</span>
          <input className={inputClass} name="role_en" value={values.role_en} onChange={event => update('role_en', event.target.value)} maxLength={100} placeholder="Full-stack development" />
        </label>
        <label className={labelClass}>
          <span>團隊人數（留空表示不顯示）</span>
          <input className={inputClass} name="team_size" type="number" min={1} step={1} inputMode="numeric" value={values.team_size} onChange={event => update('team_size', event.target.value)} />
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>
            <span>開始日期</span>
            <input className={inputClass} name="period_start" type="date" value={values.period_start} onChange={event => update('period_start', event.target.value)} />
          </label>
          <label className={labelClass}>
            <span>結束日期（進行中可留空）</span>
            <input className={inputClass} name="period_end" type="date" value={values.period_end} onChange={event => update('period_end', event.target.value)} />
          </label>
        </div>
        <label className={labelClass}>
          <span>Demo URL</span>
          <input className={inputClass} name="demo_url" value={values.demo_url} onChange={event => update('demo_url', event.target.value)} placeholder="https://..." autoComplete="off" inputMode="url" />
        </label>
        <label className={labelClass}>
          <span>程式碼倉庫 URL</span>
          <input className={inputClass} name="repo_url" value={values.repo_url} onChange={event => update('repo_url', event.target.value)} placeholder="https://github.com/..." autoComplete="off" inputMode="url" />
        </label>
      </div>
    </fieldset>

    <fieldset className="grid gap-5 border-t border-[var(--rule)] pt-6">
      <legend className={legendClass}>發布</legend>
      <div className="grid gap-5 lg:grid-cols-2">
        <label className={labelClass}>
          <span>狀態</span>
          <select className={inputClass} name="status" value={values.status} onChange={event => update('status', event.target.value as ContentStatus)}>
            {statusValues.map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}
          </select>
        </label>
        <label className={labelClass}>
          <span>發布時間（以你的裝置時區顯示；狀態為「已發布」且留空時會使用現在時間）</span>
          <input className={inputClass} type="datetime-local" value={values.publishedAtLocal} onChange={event => update('publishedAtLocal', event.target.value)} />
        </label>
        <label className={labelClass}>
          <span>排序（數字越小越前面）</span>
          <input className={inputClass} name="sort_order" type="number" step={1} inputMode="numeric" value={values.sort_order} onChange={event => update('sort_order', event.target.value)} />
        </label>
        <label className={`${checkboxLabelClass} self-end min-h-11`}>
          <input type="checkbox" name="is_featured" checked={values.is_featured} onChange={event => update('is_featured', event.target.checked)} />
          <span>精選專案（顯示在首頁）</span>
        </label>
      </div>
    </fieldset>

    <div className="grid gap-3 border-t border-[var(--rule)] pt-6">
      <p className="text-sm text-[var(--graphite)]">至少需要一種語言的標題；缺少的另一種語言標題會在儲存時沿用已填的那一種。媒體與量化成果請先建立專案後，在編輯頁新增。</p>
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton disabled={created}>{project ? '儲存專案' : '建立專案'}</SubmitButton>
        <DirtyBadge dirty={dirty} />
      </div>
      <StatusMessage state={state}>
        {state.ok ? <>
          <Link className={linkClass} href="/admin/projects">回到專案列表</Link>
          {created ? <>{' '}<Link className={linkClass} href="/admin/projects/new">再新增一個</Link></> : null}
        </> : null}
      </StatusMessage>
      {created ? <p className="text-sm text-[var(--graphite)]">專案已建立。若要繼續修改或新增媒體、量化成果，請從列表進入該專案的編輯頁，以免重複建立。</p> : null}
    </div>
  </form>;
}

export function DeleteProjectForm({ id, slug }: { id: string; slug: string }) {
  const [state, formAction] = useActionState(deleteProjectAction, initialState);
  const [confirmed, setConfirmed] = useState(false);

  return <form className="grid gap-4" action={formAction}>
    <input type="hidden" name="id" value={id} />
    <input type="hidden" name="slug" value={slug} />
    <p className="text-sm text-[var(--graphite)]">刪除後無法復原，媒體與量化成果會一併刪除，公開頁面的 /zh/projects/{slug} 與 /en/projects/{slug} 會立即消失。</p>
    <label className={checkboxLabelClass}>
      <input type="checkbox" name="confirm" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required disabled={state.ok} />
      <span>我確定要刪除這個專案</span>
    </label>
    <SubmitButton variant="danger" disabled={!confirmed || state.ok}>刪除專案</SubmitButton>
    <StatusMessage state={state}>
      {state.ok ? <Link className={linkClass} href="/admin/projects">回到專案列表</Link> : null}
    </StatusMessage>
  </form>;
}
