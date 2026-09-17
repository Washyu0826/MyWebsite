'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import type { ContentStatus, Post } from '@/types/content';
import { deleteArticleAction, saveArticleAction, type ArticleEditorState } from './actions';
import { translateArticleAction, type TranslateArticleInput } from './translate-action';

type Lang = TranslateArticleInput['from'];

type FormValues = {
  title_zh: string; title_en: string; slug: string; status: ContentStatus; publishedAtLocal: string;
  excerpt_zh: string; excerpt_en: string; body_zh: string; body_en: string;
  cover_url: string; cover_alt_zh: string; cover_alt_en: string; tags: string; reading_minutes: string;
};

const initialState: ArticleEditorState = { ok: false, message: '' };

const statusOptions: { value: ContentStatus; label: string }[] = [
  { value: 'draft', label: '草稿' },
  { value: 'scheduled', label: '排程' },
  { value: 'published', label: '已發布' },
  { value: 'archived', label: '封存' },
];

const labelClass = 'grid gap-2 text-sm text-[var(--graphite)]';
const inputClass = 'min-h-11 w-full border border-[var(--rule)] bg-[var(--paper)] px-3 py-2 text-base text-[var(--ink)]';
const textareaClass = `${inputClass} font-mono text-sm leading-relaxed`;
const legendClass = 'mb-4 text-lg font-semibold text-[var(--ink)]';

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

function valuesFromPost(post: Post | null): FormValues {
  return {
    title_zh: post?.title_zh || '',
    title_en: post?.title_en || '',
    slug: post?.slug || '',
    status: post?.status || 'draft',
    publishedAtLocal: '',
    excerpt_zh: post?.excerpt_zh || '',
    excerpt_en: post?.excerpt_en || '',
    body_zh: post?.body_zh || '',
    body_en: post?.body_en || '',
    cover_url: post?.cover_url || '',
    cover_alt_zh: post?.cover_alt_zh || '',
    cover_alt_en: post?.cover_alt_en || '',
    tags: (post?.tags || []).join(', '),
    reading_minutes: post?.reading_minutes ? String(post.reading_minutes) : '',
  };
}

function SubmitButton({ children, disabled = false, variant = 'primary' }: { children: string; disabled?: boolean; variant?: 'primary' | 'danger' }) {
  const { pending } = useFormStatus();
  return <button className={`admin-button ${variant === 'danger' ? 'admin-button-danger' : ''}`} type="submit" disabled={pending || disabled}>
    {pending ? '處理中...' : children}
  </button>;
}

function StatusMessage({ state, children }: { state: ArticleEditorState; children?: React.ReactNode }) {
  return <p className={state.ok ? 'admin-success' : 'admin-error'} role="status" aria-live="polite">
    {state.message}
    {state.message && children ? <> {children}</> : null}
  </p>;
}

export function ArticleForm({ post }: { post: Post | null }) {
  const [state, formAction] = useActionState(saveArticleAction, initialState);
  const [values, setValues] = useState<FormValues>(() => valuesFromPost(post));
  const [overwrite, setOverwrite] = useState(false);
  const [translateMessage, setTranslateMessage] = useState<{ ok: boolean; text: string }>({ ok: true, text: '' });
  const [translating, setTranslating] = useState<Lang | null>(null);
  const [translatePending, startTranslate] = useTransition();
  const defaultPublishedAt = post?.published_at || null;

  // Local-time conversion depends on the browser's timezone, so it runs after hydration.
  useEffect(() => {
    setValues(current => ({ ...current, publishedAtLocal: toLocalDateTimeInput(defaultPublishedAt) }));
  }, [defaultPublishedAt]);

  const created = state.ok && !post;

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues(current => ({ ...current, [key]: value }));
  }

  function translate(to: Lang) {
    const from: Lang = to === 'zh' ? 'en' : 'zh';
    const source = { title: values[`title_${from}`], excerpt: values[`excerpt_${from}`], body: values[`body_${from}`] };
    if (!source.title.trim() && !source.excerpt.trim() && !source.body.trim()) {
      setTranslateMessage({ ok: false, text: from === 'zh' ? '中文欄位是空的，沒有內容可以翻譯。' : 'English 欄位是空的，沒有內容可以翻譯。' });
      return;
    }
    setTranslating(to);
    setTranslateMessage({ ok: true, text: '' });
    startTranslate(async () => {
      const result = await translateArticleAction({ from, to, ...source });
      setTranslating(null);
      if (!result.ok) {
        setTranslateMessage({ ok: false, text: result.message });
        return;
      }
      const skipped: string[] = [];
      setValues(current => {
        const next = { ...current };
        const apply = (key: 'title' | 'excerpt' | 'body', label: string) => {
          const target = `${key}_${to}` as const;
          if (overwrite || !current[target].trim()) next[target] = result.data[key];
          else skipped.push(label);
        };
        apply('title', '標題');
        apply('excerpt', '摘要');
        apply('body', '內文');
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
    {post ? <input type="hidden" name="id" value={post.id} /> : null}
    <input type="hidden" name="published_at" value={fromLocalDateTimeInput(values.publishedAtLocal)} />

    <fieldset className="grid gap-5 md:grid-cols-2">
      <legend className={legendClass}>基本設定</legend>
      <label className={labelClass}>
        <span>Slug（網址用，英文小寫與連字號；留空時會從標題自動產生）</span>
        <input className={inputClass} name="slug" value={values.slug} onChange={event => update('slug', event.target.value)} placeholder="database-index-notes" autoComplete="off" />
      </label>
      <label className={labelClass}>
        <span>狀態</span>
        <select className={inputClass} name="status" value={values.status} onChange={event => update('status', event.target.value as ContentStatus)}>
          {statusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className={labelClass}>
        <span>發布時間（以你的裝置時區顯示；狀態為「已發布」且留空時會使用現在時間）</span>
        <input className={inputClass} type="datetime-local" value={values.publishedAtLocal} onChange={event => update('publishedAtLocal', event.target.value)} />
      </label>
      <label className={labelClass}>
        <span>標籤（以逗號分隔，最多 12 個）</span>
        <input className={inputClass} name="tags" value={values.tags} onChange={event => update('tags', event.target.value)} placeholder="postgres, indexing, notes" autoComplete="off" />
      </label>
      <label className={labelClass}>
        <span>閱讀時間（分鐘，留空會自動估算）</span>
        <input className={inputClass} name="reading_minutes" type="number" min={1} step={1} inputMode="numeric" value={values.reading_minutes} onChange={event => update('reading_minutes', event.target.value)} />
      </label>
      <label className={labelClass}>
        <span>封面圖片 URL</span>
        <input className={inputClass} name="cover_url" type="url" value={values.cover_url} onChange={event => update('cover_url', event.target.value)} placeholder="https://..." autoComplete="off" />
      </label>
      <label className={labelClass}>
        <span>封面替代文字（中文）</span>
        <input className={inputClass} name="cover_alt_zh" value={values.cover_alt_zh} onChange={event => update('cover_alt_zh', event.target.value)} />
      </label>
      <label className={labelClass}>
        <span>封面替代文字（English）</span>
        <input className={inputClass} name="cover_alt_en" value={values.cover_alt_en} onChange={event => update('cover_alt_en', event.target.value)} />
      </label>
    </fieldset>

    <section className="grid gap-4 border-t border-[var(--rule)] pt-6" aria-labelledby="ai-translate-heading">
      <h2 id="ai-translate-heading" className="text-lg font-semibold">AI 翻譯</h2>
      <p className="text-sm text-[var(--graphite)]">
        用 Claude 把標題、摘要與內文翻譯到另一種語言，只會填入下方欄位作為草稿，不會自動儲存。請務必人工校對後再按「儲存文章」。
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <button className="admin-button" type="button" onClick={() => translate('en')} disabled={translatePending}>
          {translatePending && translating === 'en' ? '翻譯中...' : '用 AI 翻譯成英文'}
        </button>
        <button className="admin-button" type="button" onClick={() => translate('zh')} disabled={translatePending}>
          {translatePending && translating === 'zh' ? '翻譯中...' : '用 AI 翻譯成中文'}
        </button>
        <label className="flex items-center gap-2 text-sm text-[var(--graphite)]">
          <input type="checkbox" checked={overwrite} onChange={event => setOverwrite(event.target.checked)} />
          <span>覆蓋現有內容</span>
        </label>
      </div>
      <p className={translateMessage.ok ? 'admin-success' : 'admin-error'} role="status" aria-live="polite">
        {translatePending ? '正在呼叫 Claude 翻譯，長文可能需要一到兩分鐘...' : translateMessage.text}
      </p>
    </section>

    <div className="grid gap-8 lg:grid-cols-2">
      <fieldset className="grid gap-5">
        <legend className={legendClass}>中文內容</legend>
        <label className={labelClass}>
          <span>標題（中文）</span>
          <input className={inputClass} name="title_zh" value={values.title_zh} onChange={event => update('title_zh', event.target.value)} maxLength={200} />
        </label>
        <label className={labelClass}>
          <span>摘要（中文）</span>
          <textarea className={textareaClass} name="excerpt_zh" rows={3} value={values.excerpt_zh} onChange={event => update('excerpt_zh', event.target.value)} maxLength={1000} />
        </label>
        <label className={labelClass}>
          <span>內文（中文，Markdown）</span>
          <textarea className={textareaClass} name="body_zh" rows={20} value={values.body_zh} onChange={event => update('body_zh', event.target.value)} spellCheck={false} />
        </label>
      </fieldset>

      <fieldset className="grid gap-5">
        <legend className={legendClass}>English 內容</legend>
        <label className={labelClass}>
          <span>標題（English）</span>
          <input className={inputClass} name="title_en" value={values.title_en} onChange={event => update('title_en', event.target.value)} maxLength={200} />
        </label>
        <label className={labelClass}>
          <span>摘要（English）</span>
          <textarea className={textareaClass} name="excerpt_en" rows={3} value={values.excerpt_en} onChange={event => update('excerpt_en', event.target.value)} maxLength={1000} />
        </label>
        <label className={labelClass}>
          <span>內文（English，Markdown）</span>
          <textarea className={textareaClass} name="body_en" rows={20} value={values.body_en} onChange={event => update('body_en', event.target.value)} spellCheck={false} />
        </label>
      </fieldset>
    </div>

    <div className="grid gap-3 border-t border-[var(--rule)] pt-6">
      <p className="text-sm text-[var(--graphite)]">至少需要一種語言的標題與內文；缺少的另一種語言會在儲存時沿用已填的那一種。</p>
      <SubmitButton disabled={created}>{post ? '儲存文章' : '建立文章'}</SubmitButton>
      <StatusMessage state={state}>
        {state.ok ? <>
          <Link className="text-[var(--indigo)] underline" href="/admin/articles">回到文章列表</Link>
          {created ? <>{' '}<Link className="text-[var(--indigo)] underline" href="/admin/articles/new">再新增一篇</Link></> : null}
        </> : null}
      </StatusMessage>
      {created ? <p className="text-sm text-[var(--graphite)]">文章已建立。若要繼續修改，請從列表進入該篇文章的編輯頁，以免重複建立。</p> : null}
    </div>
  </form>;
}

export function DeleteArticleForm({ id, slug }: { id: string; slug: string }) {
  const [state, formAction] = useActionState(deleteArticleAction, initialState);
  const [confirmed, setConfirmed] = useState(false);

  return <form className="grid gap-4" action={formAction}>
    <input type="hidden" name="id" value={id} />
    <input type="hidden" name="slug" value={slug} />
    <p className="text-sm text-[var(--graphite)]">刪除後無法復原，公開頁面的 /zh/articles/{slug} 與 /en/articles/{slug} 會立即消失。</p>
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name="confirm" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required disabled={state.ok} />
      <span>我確定要刪除這篇文章</span>
    </label>
    <SubmitButton variant="danger" disabled={!confirmed || state.ok}>刪除文章</SubmitButton>
    <StatusMessage state={state}>
      {state.ok ? <Link className="text-[var(--indigo)] underline" href="/admin/articles">回到文章列表</Link> : null}
    </StatusMessage>
  </form>;
}
