'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Archive, ArrowLeft, ArrowRight, Check, Copy, ExternalLink, File, Folder, History, ImageIcon, LoaderCircle, MoreHorizontal, RefreshCw, RotateCcw, Search, Trash2, Upload, X } from 'lucide-react';
import { assetRequest } from '@/lib/assets/client';
import { assetQuotaBytes, eventLabels, formatAssetBytes, referenceHref, referenceLabel, slotLabels, type AssetDetail, type AssetEvent, type AssetList, type AssetPublication, type PublishSlot } from '@/lib/assets/model';
import { AssetUpload } from './asset-upload';

type View = 'library' | 'trash' | 'activity' | 'legacy';
function date(value: string) { return new Date(value).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' }); }
function errorText(error: unknown) { return error instanceof Error ? error.message : '操作失敗。'; }
function Tool({ label, children, onClick, disabled }: { label: string; children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" className="asset-icon" title={label} aria-label={label} onClick={onClick} disabled={disabled}>{children}</button>;
}

export function AssetWorkspace() {
  const [view, setView] = useState<View>('library');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [upload, setUpload] = useState(false);
  const [list, setList] = useState<AssetList>({ items: [], count: 0, page: 1, usedBytes: 0 });
  const [events, setEvents] = useState<AssetEvent[]>([]);
  const [loaded, setLoaded] = useState({ key: '', error: '' });
  const requestKey = `${view}:${page}:${search}:${revision}`;
  const busy = loaded.key !== requestKey;
  const error = loaded.key === requestKey ? loaded.error : '';
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  function changeView(next: View) { setView(next); setPage(1); setSelected(null); setSearch(''); setQuery(''); }

  useEffect(() => {
    if (view === 'legacy') return;
    const controller = new AbortController();
    const params = new URLSearchParams({ view, page: String(page), q: search });
    void assetRequest<AssetList & { events?: AssetEvent[] }>(undefined, `?${params}`, controller.signal).then(data => {
      if (view === 'activity') { setEvents(data.events || []); setList(previous => ({ ...previous, count: data.count })); }
      else setList(data);
      setLoaded({ key: requestKey, error: '' });
    }).catch(error => { if (!controller.signal.aborted) setLoaded({ key: requestKey, error: errorText(error) }); });
    return () => controller.abort();
  }, [view, page, search, revision, requestKey]);

  return <div className="asset-workspace">
    <header className="asset-heading"><div><p className="asset-eyebrow">WORKSPACE</p><h1>素材庫</h1></div><button className="asset-primary" onClick={() => { changeView('library'); setUpload(value => !value); }}><Upload size={18} />上傳檔案</button></header>
    <div className="asset-shell">
      <aside className="asset-sidebar"><nav aria-label="素材分類">
        {([['library', '私人素材', Archive], ['trash', '垃圾桶', Trash2], ['activity', '操作紀錄', History], ['legacy', '既有公開檔案', Folder]] as const).map(([key, label, Icon]) =>
          <button key={key} aria-current={view === key ? 'page' : undefined} onClick={() => changeView(key)}><Icon size={18} />{label}</button>)}
      </nav><div className="asset-quota"><span>容量與預留</span><strong>{formatAssetBytes(list.usedBytes)} <span>/ 800 MB</span></strong><meter min={0} max={assetQuotaBytes} value={list.usedBytes} aria-label="儲存與預留容量" /></div></aside>
      <section className="asset-content" aria-label="素材列表">
        {upload && view === 'library' && <section className="asset-upload-band"><div className="asset-section-heading"><h2>上傳佇列</h2><Tool label="收合上傳佇列" onClick={() => setUpload(false)}><X size={18} /></Tool></div><AssetUpload onComplete={version => { setSelected(version.asset_id); refresh(); }} /></section>}
        {view === 'legacy' ? <LegacyFiles /> : <>
          <div className="asset-toolbar">{view !== 'activity' ? <form className="asset-search" onSubmit={event => { event.preventDefault(); setSearch(query); setPage(1); }}><Search size={18} aria-hidden="true" /><input aria-label="搜尋檔案名稱" placeholder="搜尋檔案名稱" value={query} onChange={event => setQuery(event.target.value)} /><button type="submit" className="asset-icon" title="搜尋" aria-label="搜尋"><ArrowRight size={17} /></button></form> : <h2>操作紀錄</h2>}<Tool label="重新整理" onClick={refresh}><RefreshCw size={17} /></Tool></div>
          {error ? <div className="asset-empty"><p className="asset-error" role="alert">{error}</p><button className="asset-secondary" onClick={refresh}><RefreshCw size={16} />重試</button></div>
            : busy ? <div className="asset-empty" role="status"><LoaderCircle className="asset-spin" size={22} />載入中</div>
              : view === 'activity' ? <div className="asset-event-list">{events.length ? events.map(event => <button className="asset-event" key={event.id} onClick={() => setSelected(event.asset_id)}><History size={16} /><span>{eventLabels[event.action] || event.action}<small>{event.asset_id.slice(0, 8)}</small></span><time>{date(event.created_at)}</time></button>) : <p className="asset-empty">尚無操作紀錄</p>}</div>
                : list.items.length ? <div className="asset-table" role="table" aria-label="檔案"><div className="asset-table-head" role="row"><span role="columnheader">名稱</span><span role="columnheader">狀態</span><span role="columnheader">大小</span><span role="columnheader">更新時間</span><span role="columnheader" className="sr-only">操作</span></div>
                  {list.items.map(asset => <div className={`asset-table-row ${selected === asset.id ? 'is-selected' : ''}`} key={asset.id} role="row"><div role="cell"><button className="asset-name-cell" onClick={() => setSelected(asset.id)}>{asset.current?.mime_type.startsWith('image/') ? <ImageIcon size={21} /> : <File size={21} />}<span>{asset.name}<small>{asset.version_count} 個版本</small></span></button></div><span role="cell" className={`asset-status ${asset.published ? 'is-public' : ''}`}>{asset.deleted_at ? '已回收' : asset.published ? '有公開副本' : asset.current ? '私人' : '待驗證'}</span><span role="cell" className="asset-size">{asset.current ? formatAssetBytes(asset.current.size_bytes) : '-'}</span><time role="cell" className="asset-date">{date(asset.updated_at)}</time><span role="cell"><Tool label={`檢視 ${asset.name}`} onClick={() => setSelected(asset.id)}><MoreHorizontal size={18} /></Tool></span></div>)}
                </div> : <div className="asset-empty"><Archive size={30} /><h2>{view === 'trash' ? '垃圾桶是空的' : '尚無符合條件的素材'}</h2></div>}
          {!error && <div className="asset-pagination"><span>{list.count} 筆</span><div><Tool label="上一頁" onClick={() => setPage(value => value - 1)} disabled={busy || page <= 1}><ArrowLeft size={17} /></Tool><span>{page} / {Math.max(1, Math.ceil(list.count / 25))}</span><Tool label="下一頁" onClick={() => setPage(value => value + 1)} disabled={busy || page * 25 >= list.count}><ArrowRight size={17} /></Tool></div></div>}
        </>}
      </section>
      {selected && <AssetInspector key={selected} id={selected} revision={revision} onClose={() => setSelected(null)} onChange={refresh} />}
    </div>
  </div>;
}

function AssetInspector({ id, revision, onClose, onChange }: { id: string; revision: number; onClose: () => void; onChange: () => void }) {
  const [detail, setDetail] = useState<AssetDetail | null>(null);
  const [name, setName] = useState('');
  const [versionId, setVersionId] = useState('');
  const [slot, setSlot] = useState<PublishSlot>('public');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);
  const [preview, setPreview] = useState('');
  const [tab, setTab] = useState<'versions' | 'history'>('versions');
  const publicationRequest = useRef<{ version: string; slot: string; id: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    void assetRequest<AssetDetail>(undefined, `?id=${id}`, controller.signal).then(value => {
      setDetail(value); setName(value.asset.name); setVersionId(previous => value.versions.some(v => v.id === previous) ? previous : value.asset.current_version_id || value.versions[0]?.id || '');
      if (value.publications.some(p => p.request_id === publicationRequest.current?.id && p.status === 'conflict')) publicationRequest.current = null;
    }).catch(error => { if (!controller.signal.aborted) setError(errorText(error)); });
    return () => controller.abort();
  }, [id, revision]);
  const current = detail?.versions.find(version => version.id === versionId);
  async function act(body: Record<string, unknown>, success: string) {
    setWorking(true); setError(''); setMessage('');
    try { await assetRequest(body); setMessage(success); onChange(); return true; }
    catch (error) { setError(errorText(error)); onChange(); return false; }
    finally { setWorking(false); }
  }
  async function showPreview() {
    setWorking(true); setError('');
    try { const result = await assetRequest<{ url: string }>({ action: 'preview', versionId }); setPreview(result.url); }
    catch (error) { setError(errorText(error)); }
    finally { setWorking(false); }
  }
  async function publish() {
    const pending = detail?.publications.find(p => p.version_id === versionId && p.slot === slot && p.status === 'pending');
    if (publicationRequest.current?.version !== versionId || publicationRequest.current.slot !== slot) publicationRequest.current = { version: versionId, slot, id: pending?.request_id || crypto.randomUUID() };
    const completed = await act({ action: 'publish', versionId, slot, requestId: publicationRequest.current.id }, `${slotLabels[slot]}已發布，歷史版本仍保留。`);
    if (completed) publicationRequest.current = null;
  }
  const availableSlots: PublishSlot[] = current?.mime_type === 'application/pdf' ? ['public', 'resume_zh', 'resume_en'] : ['public', 'avatar'];
  const references = detail?.references ?? [];
  return <aside className="asset-inspector" aria-label="檔案詳情">
    <div className="asset-section-heading"><h2 ref={heading} tabIndex={-1}>檔案詳情</h2><Tool label="關閉詳情" onClick={onClose}><X size={18} /></Tool></div>
    {error && <p className="asset-error" role="alert">{error}</p>}{message && <p className="asset-success" role="status">{message}</p>}
    {detail && <>
      <form className="asset-rename" onSubmit={event => { event.preventDefault(); void act({ action: 'rename', id, value: name }, '名稱已更新。'); }}><label>名稱<input value={name} maxLength={240} onChange={event => setName(event.target.value)} disabled={!!detail.asset.deleted_at} /></label><Tool label="儲存名稱" onClick={() => void act({ action: 'rename', id, value: name }, '名稱已更新。')} disabled={working || !!detail.asset.deleted_at}><Check size={18} /></Tool></form>
      <div className="asset-tabs" aria-label="檔案資訊"><button aria-pressed={tab === 'versions'} onClick={() => setTab('versions')}>版本</button><button aria-pressed={tab === 'history'} onClick={() => setTab('history')}>紀錄</button></div>
      {tab === 'history' ? <ol className="asset-timeline">{detail.events.map(event => <li key={event.id}><span>{eventLabels[event.action] || event.action}</span><time>{date(event.created_at)}</time></li>)}</ol> : <>
        <label className="asset-field">版本<select value={versionId} onChange={event => { setVersionId(event.target.value); setPreview(''); setSlot('public'); }}>{detail.versions.map(version => <option value={version.id} key={version.id}>v{version.version_no} · {version.status === 'ready' ? '已驗證' : version.status === 'pending' ? '待完成' : '已取消／驗證失敗'}{detail.asset.current_version_id === version.id ? ' · 目前版本' : ''}</option>)}</select></label>
        {current && <dl className="asset-metadata"><div><dt>格式</dt><dd>{current.mime_type}</dd></div><div><dt>大小</dt><dd>{formatAssetBytes(current.size_bytes)}</dd></div><div><dt>建立</dt><dd>{date(current.created_at)}</dd></div>{current.sha256 && <div><dt>SHA-256</dt><dd className="asset-hash">{current.sha256}</dd></div>}</dl>}
        {!detail.asset.deleted_at && <>
          {current?.status === 'ready' && <div className="asset-actions"><button className="asset-secondary" disabled={working} onClick={() => void showPreview()}><ExternalLink size={16} />預覽</button><button className="asset-secondary" disabled={working || versionId === detail.asset.current_version_id} onClick={() => void act({ action: 'version', id, value: versionId }, '目前版本已切換。公開內容仍保留原發布版本。')}><RotateCcw size={16} />設為目前版本</button></div>}
          {current?.status === 'pending' && <div className="asset-actions"><button className="asset-secondary" disabled={working} onClick={() => void act({ action: 'complete', versionId }, '檔案驗證完成。')}><RefreshCw size={16} />重試驗證</button><button className="asset-secondary" disabled={working} onClick={() => void act({ action: 'cancel', id, value: versionId }, '此版本已取消；檔案與紀錄仍保留。')}><X size={16} />取消版本</button></div>}
          {preview && <div className="asset-preview">{current?.mime_type.startsWith('image/') ? <Image src={preview} unoptimized width={600} height={450} alt={detail.asset.name} onError={() => setPreview('')} /> : <File size={40} />}<a href={preview} target="_blank" rel="noreferrer">開啟檔案 <ExternalLink size={14} /></a></div>}
          {current?.status === 'ready' && <section className="asset-publish"><h3>發布此版本</h3><label className="asset-field">用途<select value={slot} onChange={event => setSlot(event.target.value as PublishSlot)}>{availableSlots.map(value => <option key={value} value={value}>{slotLabels[value]}</option>)}</select></label><button className="asset-primary" disabled={working} onClick={() => void publish()}><ExternalLink size={16} />{working ? '處理中' : '發布'}</button></section>}
          <section className="asset-version-upload"><h3>新增版本</h3><AssetUpload assetId={id} onComplete={version => { setVersionId(version.id); onChange(); }} /></section>
        </>}
        {references.length > 0 && <section className="asset-references"><h3>使用位置</h3><p className="asset-muted">這些頁面還在用它的公開副本；更換那裡的引用後才能回收。</p><ul>{references.map((reference, index) => <li key={`${reference.publication_id}-${index}`}><a href={referenceHref(reference)} target="_blank" rel="noreferrer">{referenceLabel(reference)}</a></li>)}</ul></section>}
        {detail.publications.length > 0 && <section className="asset-publications"><h3>公開紀錄</h3>{detail.publications.map(publication => <PublicationRow key={publication.id} publication={publication} disabled={working} retry={() => void act({ action: 'publish', versionId: publication.version_id, slot: publication.slot, requestId: publication.request_id }, '發布完成。')} />)}</section>}
      </>}
      <div className="asset-inspector-footer">{detail.asset.deleted_at ? <button className="asset-secondary" disabled={working} onClick={() => void act({ action: 'restore', id }, '檔案已還原。')}><RotateCcw size={16} />還原檔案</button> : <button className="asset-secondary" disabled={working || references.length > 0} title={references.length ? '仍有頁面使用此素材，請先更換引用。' : undefined} onClick={() => void act({ action: 'trash', id }, '已移至垃圾桶。公開副本仍保留。')}><Trash2 size={16} />移至垃圾桶</button>}</div>
    </>}
  </aside>;
}

function PublicationRow({ publication, retry, disabled }: { publication: AssetPublication; retry: () => void; disabled: boolean }) {
  const [copied, setCopied] = useState(false); const [error, setError] = useState('');
  async function copy() {
    try { await navigator.clipboard.writeText(publication.public_url!); setCopied(true); setError(''); }
    catch { setError('無法複製，請開啟檔案後複製網址。'); }
  }
  return <div className="asset-publication"><span>{slotLabels[publication.slot]}<small>{publication.status === 'complete' ? date(publication.completed_at!) : publication.status === 'conflict' ? '資料已變更，需重新發布' : '等待完成'}</small></span>
    {publication.public_url && publication.status === 'complete' && <><a className="asset-icon" title="開啟公開檔案" aria-label="開啟公開檔案" href={publication.public_url} target="_blank" rel="noreferrer"><ExternalLink size={16} /></a><Tool label={copied ? '已複製' : '複製公開連結'} onClick={() => void copy()}>{copied ? <Check size={16} /> : <Copy size={16} />}</Tool></>}
    {publication.status === 'pending' && <Tool label="重試發布" onClick={retry} disabled={disabled}><RefreshCw size={16} /></Tool>}{error && <p className="asset-error" role="alert">{error}</p>}
  </div>;
}

function LegacyFiles() {
  const [bucket, setBucket] = useState('media'); const [prefix, setPrefix] = useState(''); const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: { name: string; path: string; folder: boolean; url: string; size: number }[]; more: boolean }>({ items: [], more: false });
  const [loaded, setLoaded] = useState({ key: '', error: '' });
  const requestKey = `${bucket}:${prefix}:${page}`;
  const busy = loaded.key !== requestKey;
  const error = loaded.key === requestKey ? loaded.error : '';
  useEffect(() => {
    const controller = new AbortController();
    void assetRequest<typeof data>(undefined, `?${new URLSearchParams({ view: 'legacy', bucket, prefix, page: String(page) })}`, controller.signal).then(value => { setData(value); setLoaded({ key: requestKey, error: '' }); }).catch(error => { if (!controller.signal.aborted) setLoaded({ key: requestKey, error: errorText(error) }); });
    return () => controller.abort();
  }, [bucket, prefix, page, requestKey]);
  return <><div className="asset-toolbar"><label className="asset-field">公開儲存區<select value={bucket} onChange={event => { setBucket(event.target.value); setPrefix(''); setPage(1); }}><option value="media">圖片</option><option value="resume">履歷 / PDF</option></select></label>{prefix && <Tool label="上一層" onClick={() => { setPrefix(prefix.split('/').slice(0, -1).join('/')); setPage(1); }}><ArrowLeft size={18} /></Tool>}</div><p className="asset-muted asset-path">{bucket}/{prefix}</p>{error && <p className="asset-error" role="alert">{error}</p>}
    {busy ? <p className="asset-empty" role="status">載入中</p> : !error && <div className="asset-legacy-list">{data.items.map(item => item.folder ? <button key={item.path} onClick={() => { setPrefix(item.path); setPage(1); }}><Folder size={20} /><span>{item.name}</span><ArrowRight size={16} /></button> : <a key={item.path} href={item.url} target="_blank" rel="noreferrer"><File size={20} /><span>{item.name}<small>{formatAssetBytes(item.size)}</small></span><ExternalLink size={16} /></a>)}</div>}
    <div className="asset-pagination"><span>第 {page} 頁</span><div><Tool label="上一頁" disabled={page === 1} onClick={() => setPage(value => value - 1)}><ArrowLeft size={16} /></Tool><Tool label="下一頁" disabled={!data.more} onClick={() => setPage(value => value + 1)}><ArrowRight size={16} /></Tool></div></div></>;
}
