'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import type { ProjectMedia, ProjectMetric } from '@/types/content';
import {
  addMediaAction, addMetricAction, deleteMediaAction, deleteMetricAction, updateMediaAction, updateMetricAction,
  type ProjectEditorState,
} from './actions';
import { mediaTypes, type MediaType } from './fields';
import {
  checkboxLabelClass, initialState, inputClass, labelClass, StatusMessage, SubmitButton, UrlField,
} from './form-shared';

const mediaTypeLabels: Record<MediaType, string> = { image: '圖片', video: '影片' };

/** Resets an uncontrolled add-form after a successful submit so the next row starts blank. */
function useResetOnSuccess(state: ProjectEditorState, onReset: () => void) {
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.reset();
    onReset();
    // `state` is a fresh object per submit, so this runs once per successful action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return formRef;
}

function DeleteRowForm({ action, projectId, rowId, label }: {
  action: typeof deleteMediaAction; projectId: string; rowId: string; label: string;
}) {
  const [state, formAction] = useActionState(action, initialState);
  const [confirmed, setConfirmed] = useState(false);
  return <form className="grid gap-2" action={formAction}>
    <input type="hidden" name="project_id" value={projectId} />
    <input type="hidden" name="id" value={rowId} />
    <label className={checkboxLabelClass}>
      <input type="checkbox" name="confirm" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={state.ok} />
      <span>確認刪除</span>
    </label>
    <SubmitButton variant="danger" small disabled={!confirmed || state.ok}>{label}</SubmitButton>
    <StatusMessage state={state} />
  </form>;
}

// ---------------------------------------------------------------------------
// media
// ---------------------------------------------------------------------------

function MediaFields({ projectId, prefix, media, url, setUrl, size, setSize, mediaType, setMediaType }: {
  projectId: string; prefix: string; media: ProjectMedia | null;
  url: string; setUrl: (value: string) => void;
  size: { width: number; height: number } | null;
  setSize: (value: { width: number; height: number } | null) => void;
  mediaType: MediaType; setMediaType: (value: MediaType) => void;
}) {
  return <>
    <input type="hidden" name="project_id" value={projectId} />
    {media ? <input type="hidden" name="id" value={media.id} /> : null}
    {/* Measured by the upload pipeline; lets the public gallery reserve the right box. */}
    {size ? <>
      <input type="hidden" name="width" value={size.width} />
      <input type="hidden" name="height" value={size.height} />
    </> : null}
    <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
      <UrlField label="媒體網址" name="url" value={url} onChange={setUrl} onMeta={setSize} prefix={prefix} upload={mediaType === 'image'}
        hint={size ? `已記錄尺寸 ${size.width}×${size.height}。` : undefined} />
      <label className={labelClass}>
        <span>類型</span>
        <select className={inputClass} name="media_type" value={mediaType} onChange={event => setMediaType(event.target.value as MediaType)}>
          {mediaTypes.map(type => <option key={type} value={type}>{mediaTypeLabels[type]}（{type}）</option>)}
        </select>
      </label>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <label className={labelClass}>
        <span>替代文字（中文）</span>
        <input className={inputClass} name="alt_zh" defaultValue={media?.alt_zh || ''} maxLength={300} />
      </label>
      <label className={labelClass}>
        <span>替代文字（English）</span>
        <input className={inputClass} name="alt_en" defaultValue={media?.alt_en || ''} maxLength={300} />
      </label>
      <label className={labelClass}>
        <span>說明（中文）</span>
        <input className={inputClass} name="caption_zh" defaultValue={media?.caption_zh || ''} maxLength={500} />
      </label>
      <label className={labelClass}>
        <span>說明（English）</span>
        <input className={inputClass} name="caption_en" defaultValue={media?.caption_en || ''} maxLength={500} />
      </label>
      <label className={labelClass}>
        <span>排序（數字越小越前面）</span>
        <input className={inputClass} name="sort_order" type="number" step={1} inputMode="numeric" defaultValue={media ? media.sort_order : 0} />
      </label>
    </div>
  </>;
}

function MediaRow({ projectId, prefix, media }: { projectId: string; prefix: string; media: ProjectMedia }) {
  const [state, formAction] = useActionState(updateMediaAction, initialState);
  const [url, setUrl] = useState(media.url);
  const [size, setSize] = useState(media.width && media.height ? { width: media.width, height: media.height } : null);
  const [mediaType, setMediaType] = useState<MediaType>(media.media_type === 'video' ? 'video' : 'image');
  const headingId = `media-${media.id}`;

  return <article className="grid gap-4 border border-[var(--rule)] p-4" aria-labelledby={headingId}>
    <h3 id={headingId} className="text-sm font-semibold text-[var(--ink)]">
      #{media.sort_order} · {mediaTypeLabels[mediaType]} ·{' '}
      <a className="text-[var(--indigo)] underline break-all" href={media.url} target="_blank" rel="noreferrer">{media.url}</a>
    </h3>
    <form className="grid gap-4" action={formAction}>
      <MediaFields projectId={projectId} prefix={prefix} media={media} url={url} setUrl={setUrl} size={size} setSize={setSize} mediaType={mediaType} setMediaType={setMediaType} />
      <SubmitButton small>儲存媒體</SubmitButton>
      <StatusMessage state={state} />
    </form>
    <DeleteRowForm action={deleteMediaAction} projectId={projectId} rowId={media.id} label="刪除媒體" />
  </article>;
}

function AddMediaForm({ projectId, prefix }: { projectId: string; prefix: string }) {
  const [state, formAction] = useActionState(addMediaAction, initialState);
  const [url, setUrl] = useState('');
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const formRef = useResetOnSuccess(state, () => { setUrl(''); setSize(null); setMediaType('image'); });

  return <form ref={formRef} className="grid gap-4 border border-dashed border-[var(--rule)] p-4" action={formAction} aria-labelledby="add-media-heading">
    <h3 id="add-media-heading" className="text-sm font-semibold text-[var(--ink)]">新增媒體</h3>
    <MediaFields projectId={projectId} prefix={prefix} media={null} url={url} setUrl={setUrl} size={size} setSize={setSize} mediaType={mediaType} setMediaType={setMediaType} />
    <SubmitButton>新增媒體</SubmitButton>
    <StatusMessage state={state} />
  </form>;
}

export function MediaSection({ projectId, slug, media }: { projectId: string; slug: string; media: ProjectMedia[] }) {
  const prefix = `projects/${slug || projectId}`;
  return <div className="grid gap-6">
    <p className="text-sm text-[var(--graphite)]">截圖或影片會依排序顯示在案例頁的畫廊區。圖片可直接上傳到 media bucket；影片請貼上連結。</p>
    {media.length ? media.map(item => <MediaRow key={item.id} projectId={projectId} prefix={prefix} media={item} />)
      : <p className="text-sm text-[var(--graphite)]">目前還沒有媒體。</p>}
    <AddMediaForm projectId={projectId} prefix={prefix} />
  </div>;
}

// ---------------------------------------------------------------------------
// metrics
// ---------------------------------------------------------------------------

function MetricFields({ projectId, metric }: { projectId: string; metric: ProjectMetric | null }) {
  return <>
    <input type="hidden" name="project_id" value={projectId} />
    {metric ? <input type="hidden" name="id" value={metric.id} /> : null}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className={labelClass}>
        <span>數值</span>
        <input className={inputClass} name="value" defaultValue={metric?.value || ''} maxLength={40} placeholder="120ms / 3,000+ / 40%" required />
      </label>
      <label className={labelClass}>
        <span>標籤（中文）</span>
        <input className={inputClass} name="label_zh" defaultValue={metric?.label_zh || ''} maxLength={100} placeholder="P95 延遲" />
      </label>
      <label className={labelClass}>
        <span>標籤（English）</span>
        <input className={inputClass} name="label_en" defaultValue={metric?.label_en || ''} maxLength={100} placeholder="P95 latency" />
      </label>
      <label className={labelClass}>
        <span>排序</span>
        <input className={inputClass} name="sort_order" type="number" step={1} inputMode="numeric" defaultValue={metric ? metric.sort_order : 0} />
      </label>
    </div>
  </>;
}

function MetricRow({ projectId, metric }: { projectId: string; metric: ProjectMetric }) {
  const [state, formAction] = useActionState(updateMetricAction, initialState);
  const headingId = `metric-${metric.id}`;
  return <article className="grid gap-4 border border-[var(--rule)] p-4" aria-labelledby={headingId}>
    <h3 id={headingId} className="text-sm font-semibold text-[var(--ink)]">#{metric.sort_order} · {metric.value} · {metric.label_zh || metric.label_en}</h3>
    <form className="grid gap-4" action={formAction}>
      <MetricFields projectId={projectId} metric={metric} />
      <SubmitButton small>儲存量化成果</SubmitButton>
      <StatusMessage state={state} />
    </form>
    <DeleteRowForm action={deleteMetricAction} projectId={projectId} rowId={metric.id} label="刪除量化成果" />
  </article>;
}

function AddMetricForm({ projectId }: { projectId: string }) {
  const [state, formAction] = useActionState(addMetricAction, initialState);
  const formRef = useResetOnSuccess(state, () => {});
  return <form ref={formRef} className="grid gap-4 border border-dashed border-[var(--rule)] p-4" action={formAction} aria-labelledby="add-metric-heading">
    <h3 id="add-metric-heading" className="text-sm font-semibold text-[var(--ink)]">新增量化成果</h3>
    <MetricFields projectId={projectId} metric={null} />
    <SubmitButton>新增量化成果</SubmitButton>
    <StatusMessage state={state} />
  </form>;
}

export function MetricSection({ projectId, metrics }: { projectId: string; metrics: ProjectMetric[] }) {
  return <div className="grid gap-6">
    <p className="text-sm text-[var(--graphite)]">量化成果會以「數值 + 標籤」的形式顯示在案例頁，例如「120ms · P95 延遲」。請填寫可驗證的真實數字。</p>
    {metrics.length ? metrics.map(item => <MetricRow key={item.id} projectId={projectId} metric={item} />)
      : <p className="text-sm text-[var(--graphite)]">目前還沒有量化成果。</p>}
    <AddMetricForm projectId={projectId} />
  </div>;
}
