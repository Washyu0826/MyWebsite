'use client';

import { useRef, useState, useTransition } from 'react';

export type ReorderRow = { id: string; label: string; meta?: string };

export type ReorderResult = { ok: boolean; message: string };

/**
 * Reorder a list with the mouse, the keyboard or a single tap.
 *
 * WCAG 2.2 2.5.7 (Dragging Movements) needs a non-dragging path: the 上移 / 下移 buttons are always
 * visible, are 44px targets and do the same job, so touch and switch users never have to drag.
 * 4.1.3 (Status Messages) is covered by the polite live region: every move and every save is spoken.
 * The new positions are written back through the section's existing Server Action, one row per call,
 * so no action signature or FormData field name changes.
 */
export function ReorderList({ rows, itemNoun, onSave, hint }: {
  rows: ReorderRow[];
  /** Used in the announcements, e.g. 「媒體」 -> 「已將 X 移到第 2 項」. */
  itemNoun: string;
  onSave: (orderedIds: string[]) => Promise<ReorderResult>;
  hint?: string;
}) {
  const byId = new Map(rows.map(row => [row.id, row]));
  const [order, setOrder] = useState<string[]>(() => rows.map(row => row.id));
  const [saved, setSaved] = useState<string[]>(() => rows.map(row => row.id));
  const [grabbed, setGrabbed] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; after: boolean } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [status, setStatus] = useState<ReorderResult>({ ok: true, message: '' });
  const [pending, startSave] = useTransition();
  const beforeGrab = useRef<string[]>([]);

  // Rows added or removed by another form on the page: fall back to the server order.
  const known = order.filter(id => byId.has(id));
  const missing = rows.map(row => row.id).filter(id => !known.includes(id));
  const current = [...known, ...missing];
  const dirty = current.join() !== saved.join();

  function move(id: string, to: number, verb: string) {
    const from = current.indexOf(id);
    if (from < 0 || to < 0 || to >= current.length || to === from) return;
    const next = current.filter(item => item !== id);
    next.splice(to, 0, id);
    setOrder(next);
    setStatus({ ok: true, message: '' });
    setAnnouncement(`${verb}「${byId.get(id)?.label || itemNoun}」，現在是第 ${to + 1} 項，共 ${next.length} 項。`);
  }

  function handleKey(event: React.KeyboardEvent<HTMLButtonElement>, id: string) {
    const index = current.indexOf(id);
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (grabbed === id) {
        setGrabbed(null);
        setAnnouncement(`已放下「${byId.get(id)?.label || itemNoun}」，位置第 ${index + 1} 項。記得按「儲存排序」。`);
      } else {
        beforeGrab.current = current;
        setGrabbed(id);
        setAnnouncement(`已抓起「${byId.get(id)?.label || itemNoun}」，用上下方向鍵移動，再按空白鍵放下，按 Esc 取消。`);
      }
      return;
    }
    if (event.key === 'Escape' && grabbed === id) {
      event.preventDefault();
      setOrder(beforeGrab.current);
      setGrabbed(null);
      setAnnouncement('已取消這次移動。');
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      if (grabbed !== id) return;
      event.preventDefault();
      move(id, index + (event.key === 'ArrowUp' ? -1 : 1), '已移動');
    }
  }

  function save() {
    setStatus({ ok: true, message: '' });
    const ordered = current;
    startSave(async () => {
      const result = await onSave(ordered);
      setStatus(result);
      if (result.ok) setSaved(ordered);
      setAnnouncement(result.message);
    });
  }

  function reset() {
    setOrder(saved);
    setStatus({ ok: true, message: '' });
    setAnnouncement('已還原成上次儲存的順序。');
  }

  return <div className="admin-reorder">
    <p className="admin-reorder-hint">
      {hint ? `${hint} ` : ''}
      可以直接拖曳左側的把手，或用「上移／下移」按鈕；鍵盤操作請對把手按空白鍵抓起，方向鍵移動，再按空白鍵放下。變更後要按「儲存排序」才會寫入資料庫。
    </p>
    <ul className="admin-reorder-list">
      {current.map((id, index) => {
        const row = byId.get(id);
        if (!row) return null;
        return <li key={id} className="admin-reorder-item"
          data-dragging={dragging === id || undefined}
          data-grabbed={grabbed === id || undefined}
          data-dropbefore={dropTarget?.id === id && !dropTarget.after || undefined}
          data-dropafter={dropTarget?.id === id && dropTarget.after || undefined}
          onDragOver={event => {
            if (!dragging || dragging === id) return;
            event.preventDefault();
            const box = event.currentTarget.getBoundingClientRect();
            setDropTarget({ id, after: event.clientY > box.top + box.height / 2 });
          }}
          onDragLeave={() => setDropTarget(target => (target?.id === id ? null : target))}
          onDrop={event => {
            event.preventDefault();
            if (!dragging || dragging === id) return;
            const target = current.indexOf(id);
            const from = current.indexOf(dragging);
            const after = dropTarget?.id === id ? dropTarget.after : false;
            const to = target + (after ? 1 : 0) - (from < target ? 1 : 0);
            move(dragging, Math.max(0, Math.min(current.length - 1, to)), '已拖曳');
            setDropTarget(null);
          }}
        >
          <button className="admin-reorder-handle" type="button" draggable
            aria-pressed={grabbed === id}
            aria-label={`排序把手：${row.label}，目前第 ${index + 1} 項，共 ${current.length} 項`}
            onKeyDown={event => handleKey(event, id)}
            onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; setDragging(id); }}
            onDragEnd={() => { setDragging(null); setDropTarget(null); }}
          >
            <span aria-hidden="true">⠿</span>
          </button>
          <span className="admin-reorder-text">
            <span className="admin-reorder-index">#{index + 1}</span>
            <span className="admin-reorder-label">{row.label}</span>
            {row.meta ? <span className="admin-reorder-meta">{row.meta}</span> : null}
          </span>
          <span className="admin-reorder-buttons">
            <button className="admin-reorder-move" type="button" disabled={index === 0}
              aria-label={`把「${row.label}」上移`} onClick={() => move(id, index - 1, '已上移')}>
              <span aria-hidden="true">↑</span>
            </button>
            <button className="admin-reorder-move" type="button" disabled={index === current.length - 1}
              aria-label={`把「${row.label}」下移`} onClick={() => move(id, index + 1, '已下移')}>
              <span aria-hidden="true">↓</span>
            </button>
          </span>
        </li>;
      })}
    </ul>
    <div className="admin-reorder-actions">
      <button className="admin-button" type="button" onClick={save} disabled={!dirty || pending}>
        {pending ? '儲存中...' : '儲存排序'}
      </button>
      <button className="admin-button" type="button" onClick={reset} disabled={!dirty || pending}>還原</button>
      {dirty ? <span className="admin-dirty-flag">排序尚未儲存</span> : null}
    </div>
    <p className={status.ok ? 'admin-success' : 'admin-error'}>{status.message}</p>
    <p className="admin-visually-hidden" role="status" aria-live="polite">{announcement}</p>
  </div>;
}
