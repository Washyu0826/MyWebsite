'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Upload, RotateCcw, Square } from 'lucide-react';
import { newUploadAttempt, uploadAsset, assetRequest, type UploadAttempt } from '@/lib/assets/client';
import { assetMimeTypes, slotLabels, type AssetVersion, type PublishSlot } from '@/lib/assets/model';

type Entry = { id: string; file: File; attempt: UploadAttempt; progress: number; status: string; error: string; complete: boolean };
export function AssetUpload({ assetId, slot, onComplete }: { assetId?: string; slot?: PublishSlot; onComplete?: (version: AssetVersion) => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  function select(files: File[]) {
    setEntries(files.slice(0, assetId || slot ? 1 : 20).map(file => ({ id: crypto.randomUUID(), file, attempt: newUploadAttempt(), progress: 0, status: '待上傳', error: '', complete: false })));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const abort = new AbortController();
    controller.current = abort;
    const update = (id: string, patch: Partial<Entry>) => setEntries(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row));
    try {
      for (const entry of entries.filter(row => !row.complete)) {
        if (abort.signal.aborted) break;
        update(entry.id, { error: '', status: '準備中' });
        try {
          const version = await uploadAsset(entry.file, { assetId, slot, attempt: entry.attempt, signal: abort.signal, onProgress: (progress, status) => update(entry.id, { progress, status }) });
          if (slot) {
            update(entry.id, { status: '發布中' });
            await assetRequest({ action: 'publish', versionId: version.id, slot, requestId: entry.attempt.publishId });
          }
          update(entry.id, { complete: true, progress: 100, status: slot ? `${slotLabels[slot]}已更新` : '已保存' });
          onComplete?.(version);
        } catch (error) {
          if ((error as { code?: string }).code === 'PROFILE_CHANGED') entry.attempt.publishId = crypto.randomUUID();
          update(entry.id, { error: error instanceof Error ? error.message : '上傳失敗。', status: abort.signal.aborted ? '已暫停' : '待重試' });
        }
      }
    } finally { setBusy(false); controller.current = null; }
  }

  return <form className="asset-upload" onSubmit={submit} onDragOver={event => event.preventDefault()} onDrop={event => {
    event.preventDefault(); if (!busy) select(Array.from(event.dataTransfer.files));
  }}>
    <label className="asset-file-input"><Upload size={20} aria-hidden="true" /><span>{assetId ? '新增版本' : slot ? `選擇${slotLabels[slot]}` : '選擇檔案'}</span>
      <input aria-label={assetId ? '選擇新版本檔案' : '選擇上傳檔案'} type="file" disabled={busy} multiple={!assetId && !slot}
        accept={slot?.startsWith('resume') ? 'application/pdf' : slot === 'avatar' ? 'image/png,image/jpeg,image/webp,image/gif' : assetMimeTypes.join(',')}
        onChange={event => select(Array.from(event.target.files || []))} />
    </label>
    {entries.map(entry => <div className="asset-upload-row" key={entry.id}><span className="asset-filename">{entry.file.name}</span><span className="asset-muted" role="status">{entry.status}</span>
      <progress max={100} value={entry.progress} aria-label={`${entry.file.name} 上傳進度`} />{entry.error && <p className="asset-error" role="alert">{entry.error}</p>}
    </div>)}
    <div className="asset-actions"><button type="submit" disabled={busy || !entries.some(row => !row.complete)} className="asset-primary">
      {entries.some(row => row.error) ? <RotateCcw size={16} /> : <Upload size={16} />}{busy ? '處理中' : entries.some(row => row.error) ? '重試' : slot ? '上傳並更新' : '上傳'}
    </button>{busy && <button type="button" className="asset-icon" title="暫停上傳" aria-label="暫停上傳" onClick={() => controller.current?.abort()}><Square size={16} /></button>}</div>
  </form>;
}
