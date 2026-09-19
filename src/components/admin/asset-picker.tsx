'use client';

import * as Dialog from '@radix-ui/react-dialog';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, File, Images, LoaderCircle, RefreshCw, Search, X } from 'lucide-react';
import { assetRequest } from '@/lib/assets/client';
import { formatAssetBytes, type PublishedAsset, type PublishedList } from '@/lib/assets/model';

// Picks an already published library file for an editor field. Uploading and publishing stay in the
// asset workspace; this only hands back public URLs, so it can never expose a private original.
export function AssetPicker({ onSelect, imagesOnly = true, label = '從素材庫選擇' }: {
  onSelect: (item: PublishedAsset) => void;
  imagesOnly?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild>
      <button type="button" className="admin-button min-h-9! py-1! text-xs"><Images size={14} aria-hidden="true" /> {label}</button>
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="asset-picker-overlay" />
      <Dialog.Content className="asset-picker" aria-describedby={undefined}>
        <div className="asset-section-heading">
          <Dialog.Title>素材庫：已發布的檔案</Dialog.Title>
          <Dialog.Close asChild><button type="button" className="asset-icon" title="關閉素材庫" aria-label="關閉素材庫"><X size={18} /></button></Dialog.Close>
        </div>
        {open && <PickerList imagesOnly={imagesOnly} onSelect={item => { onSelect(item); setOpen(false); }} />}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

function PickerList({ imagesOnly, onSelect }: { imagesOnly: boolean; onSelect: (item: PublishedAsset) => void }) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<PublishedList>({ items: [], count: 0, page: 1 });
  const [loaded, setLoaded] = useState({ key: '', error: '' });
  const requestKey = `${page}:${search}:${revision}`;
  const busy = loaded.key !== requestKey;
  const error = loaded.key === requestKey ? loaded.error : '';
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ view: 'published', kind: imagesOnly ? 'image' : 'any', page: String(page), q: search });
    void assetRequest<PublishedList>(undefined, `?${params}`, controller.signal)
      .then(value => { setData(value); setLoaded({ key: requestKey, error: '' }); })
      .catch(error => { if (!controller.signal.aborted) setLoaded({ key: requestKey, error: error instanceof Error ? error.message : '無法載入素材。' }); });
    return () => controller.abort();
  }, [imagesOnly, page, search, revision, requestKey]);
  const pages = Math.max(1, Math.ceil(data.count / 25));
  return <>
    <div className="asset-toolbar">
      <form className="asset-search" onSubmit={event => { event.preventDefault(); setSearch(query); setPage(1); }}>
        <Search size={18} aria-hidden="true" />
        <input aria-label="搜尋素材名稱" placeholder="搜尋素材名稱" value={query} onChange={event => setQuery(event.target.value)} />
        <button type="submit" className="asset-icon" title="搜尋" aria-label="搜尋"><ArrowRight size={17} /></button>
      </form>
      <button type="button" className="asset-icon" title="重新整理" aria-label="重新整理" onClick={() => setRevision(value => value + 1)}><RefreshCw size={17} /></button>
    </div>
    {error ? <p className="asset-error" role="alert">{error}</p>
      : busy ? <p className="asset-empty" role="status"><LoaderCircle className="asset-spin" size={22} />載入中</p>
        : data.items.length ? <ul className="asset-picker-grid" aria-label="已發布的素材">
          {data.items.map(item => <PickerItem key={item.id} item={item} onSelect={onSelect} />)}
        </ul>
          : <p className="asset-empty">尚無已發布的素材。先到素材庫上傳並發布，或用旁邊的「上傳並建立公開網址」。</p>}
    <div className="asset-pagination"><span>{data.count} 筆</span><div>
      <button type="button" className="asset-icon" title="上一頁" aria-label="上一頁" disabled={busy || page <= 1} onClick={() => setPage(value => value - 1)}><ArrowLeft size={17} /></button>
      <span>{page} / {pages}</span>
      <button type="button" className="asset-icon" title="下一頁" aria-label="下一頁" disabled={busy || page >= pages} onClick={() => setPage(value => value + 1)}><ArrowRight size={17} /></button>
    </div></div>
  </>;
}

function PickerItem({ item, onSelect }: { item: PublishedAsset; onSelect: (item: PublishedAsset) => void }) {
  const [copied, setCopied] = useState('');
  const image = item.mime_type?.startsWith('image/');
  async function copy(kind: 'url' | 'markdown') {
    const alt = item.name.replace(/\.[a-z0-9]+$/i, '').replace(/[[\]]/g, '');
    try { await navigator.clipboard.writeText(kind === 'markdown' ? `![${alt}](${item.public_url})` : item.public_url); setCopied(kind); }
    catch { setCopied(''); }
  }
  return <li className="asset-picker-item">
    {image ? <Image src={item.public_url} unoptimized width={200} height={120} alt="" /> : <div className="asset-picker-file" aria-hidden="true"><File size={32} /></div>}
    <strong>{item.name}</strong>
    <small>{item.mime_type || '檔案'}{item.size ? ` · ${formatAssetBytes(item.size)}` : ''}{item.width && item.height ? ` · ${item.width}×${item.height}` : ''}</small>
    <div className="asset-actions">
      <button type="button" className="asset-primary" onClick={() => onSelect(item)}><Check size={14} />選用</button>
      <button type="button" className="asset-icon" title={copied === 'url' ? '已複製網址' : '複製公開網址'} aria-label={copied === 'url' ? '已複製網址' : `複製 ${item.name} 的公開網址`} onClick={() => void copy('url')}>{copied === 'url' ? <Check size={15} /> : <Copy size={15} />}</button>
      {image && <button type="button" className="asset-secondary" title="複製可貼進內文的 Markdown 圖片語法" onClick={() => void copy('markdown')}>{copied === 'markdown' ? '已複製' : 'Markdown'}</button>}
    </div>
  </li>;
}
