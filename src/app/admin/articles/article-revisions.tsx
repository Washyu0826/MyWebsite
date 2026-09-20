'use client';

import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { History, RotateCcw, GitCompare } from 'lucide-react';
import { collapseUnchanged, type DiffRow, type FieldDiff } from '@/lib/diff';
import type { RevisionSummary } from '@/lib/revisions';
import { diffRevisionAction, restoreRevisionAction, type ArticleEditorState, type RevisionDiffState } from './actions';

const initialRestore: ArticleEditorState = { ok: false, message: '' };
const reasonLabels: Record<RevisionSummary['reason'], string> = { save: '儲存', restore: '還原' };

function when(value: string) {
  return new Date(value).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' });
}

function RestoreButton({ revision }: { revision: number }) {
  const { pending } = useFormStatus();
  return <button
    className="admin-button min-h-9! py-1! text-xs"
    type="submit"
    name="revision"
    value={revision}
    disabled={pending}
    onClick={event => {
      if (!window.confirm(`還原第 ${revision} 版？目前的內容會先存成一個修訂版本，文章會轉為草稿，不會直接對外發布。`)) event.preventDefault();
    }}
  ><RotateCcw size={14} aria-hidden="true" /> 還原此版</button>;
}

/**
 * Revision history for one article: what each save changed, the difference between a stored revision
 * and the article as it stands, and a restore that lands as a draft.
 */
export function ArticleRevisions({ postId, revisions }: { postId: string; revisions: RevisionSummary[] }) {
  const [restore, restoreAction] = useActionState(restoreRevisionAction, initialRestore);
  const [shown, setShown] = useState<{ revision: number; state: RevisionDiffState } | null>(null);
  const [comparing, startCompare] = useTransition();

  function compare(revision: number) {
    if (shown?.revision === revision) {
      setShown(null);
      return;
    }
    startCompare(async () => {
      const data = new FormData();
      data.set('id', postId);
      data.set('revision', String(revision));
      setShown({ revision, state: await diffRevisionAction({ ok: false, message: '' }, data) });
    });
  }

  if (!revisions.length) {
    return <p className="text-sm text-[var(--graphite)]">
      這篇文章還沒有修訂紀錄。下一次儲存會保留目前的內容，之後就能比較與還原。
    </p>;
  }

  return <div className="grid gap-4">
    <p className="text-sm text-[var(--graphite)]">
      每次儲存都會保留當時的內容。還原會先把目前的內容存成一個修訂版本，再把文章轉為草稿，確認後才需要重新發布。
    </p>
    {restore.message ? <p className={restore.ok ? 'admin-success' : 'admin-error'} role="status" aria-live="polite">{restore.message}</p> : null}

    <form action={restoreAction}>
      <input type="hidden" name="id" value={postId} />
      <ol className="admin-revision-list">
        {revisions.map(revision => <li key={revision.id} className="admin-revision">
          <div className="admin-revision-head">
            <span className="admin-revision-title">
              <History size={15} aria-hidden="true" />
              <strong>第 {revision.revision} 版</strong>
              <span className="admin-revision-meta">{when(revision.created_at)} · {reasonLabels[revision.reason]}</span>
            </span>
            <span className="admin-revision-actions">
              <button
                className="admin-secondary-link text-xs"
                type="button"
                onClick={() => compare(revision.revision)}
                aria-expanded={shown?.revision === revision.revision}
              ><GitCompare size={14} aria-hidden="true" /> {shown?.revision === revision.revision ? '收合比較' : '與目前比較'}</button>
              <RestoreButton revision={revision.revision} />
            </span>
          </div>
          <p className="admin-revision-changed">
            {revision.changed.length ? `變更：${revision.changed.join('、')}` : '這是目前保留的最早版本'}
          </p>
          {shown?.revision === revision.revision ? <RevisionDiff state={shown.state} pending={comparing} /> : null}
        </li>)}
      </ol>
    </form>
  </div>;
}

function RevisionDiff({ state, pending }: { state: RevisionDiffState; pending: boolean }) {
  if (pending) return <p className="admin-revision-changed" role="status">讀取差異中…</p>;
  if (!state.ok) return <p className="admin-error" role="alert">{state.message}</p>;
  if (!state.fields?.length) return <p className="admin-revision-changed" role="status">{state.message || '這個版本與目前內容相同。'}</p>;
  return <div className="admin-revision-diff">
    <p className="admin-revision-changed">左側是這個舊版本，右側是目前的內容。</p>
    {state.fields.map(field => <FieldDiffView key={field.field} diff={field} />)}
  </div>;
}

function FieldDiffView({ diff }: { diff: FieldDiff }) {
  const rows = collapseUnchanged(diff.rows);
  return <section className="admin-diff-field" aria-label={`${diff.label} 的差異`}>
    <h4>{diff.label} <span>−{diff.removed} / +{diff.added}</span></h4>
    <ol className="admin-diff-rows">
      {rows.map((row, index) => row.type === 'skipped'
        ? <li key={`skip-${index}`} className="admin-diff-skip">⋯ 略過 {row.count} 行未變更</li>
        : <DiffLine key={`${row.type}-${index}`} row={row} />)}
    </ol>
  </section>;
}

function DiffLine({ row }: { row: DiffRow }) {
  const sign = row.type === 'added' ? '+' : row.type === 'removed' ? '−' : ' ';
  return <li className={`admin-diff-row is-${row.type}`}>
    <span className="admin-diff-gutter" aria-hidden="true">{row.before ?? ''}</span>
    <span className="admin-diff-gutter" aria-hidden="true">{row.after ?? ''}</span>
    <span className="admin-diff-sign" aria-hidden="true">{sign}</span>
    <span className="admin-diff-text">
      {/* Screen readers get the same information the coloured background carries. */}
      <span className="sr-only">{row.type === 'added' ? '新增：' : row.type === 'removed' ? '刪除：' : ''}</span>
      {row.text || ' '}
    </span>
  </li>;
}
