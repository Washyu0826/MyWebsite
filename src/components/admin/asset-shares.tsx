'use client';

import { useState } from 'react';
import { Check, Copy, Link2, Link2Off, TriangleAlert } from 'lucide-react';
import { assetRequest } from '@/lib/assets/client';
import { shareHourLabels, shareHourOptions, type AssetShare } from '@/lib/assets/model';

function when(value: string) {
  return new Date(value).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' });
}

function stateOf(share: AssetShare) {
  if (share.revoked_at) return { label: '已撤銷', live: false };
  if (new Date(share.expires_at).getTime() <= Date.now()) return { label: '已過期', live: false };
  if (share.max_opens != null && share.opens >= share.max_opens) return { label: '已達次數上限', live: false };
  return { label: '有效', live: true };
}

/**
 * Time-limited links to one private version. The token exists in plaintext exactly once, in the
 * reply that creates it, so the panel shows it immediately and says that it will not be shown again.
 */
export function AssetShares({ versionId, shares, disabled, onChange }: {
  versionId: string;
  shares: AssetShare[];
  disabled: boolean;
  onChange: () => void;
}) {
  const [hours, setHours] = useState<number>(168);
  const [maxOpens, setMaxOpens] = useState('');
  const [label, setLabel] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [issued, setIssued] = useState('');
  const [copied, setCopied] = useState(false);

  async function create() {
    setWorking(true);
    setError('');
    setIssued('');
    setCopied(false);
    try {
      const result = await assetRequest<{ share: AssetShare; token: string }>({
        action: 'share', versionId, hours, maxOpens: maxOpens || null, label,
      });
      setIssued(`${window.location.origin}/zh/share/${result.token}`);
      setLabel('');
      setMaxOpens('');
      onChange();
    } catch (error) {
      setError(error instanceof Error ? error.message : '無法建立分享連結。');
    } finally {
      setWorking(false);
    }
  }

  async function revoke(share: AssetShare) {
    if (!window.confirm('撤銷後這個連結立即失效，無法恢復。要繼續嗎？')) return;
    setWorking(true);
    setError('');
    try {
      await assetRequest({ action: 'revoke-share', shareId: share.id });
      onChange();
    } catch (error) {
      setError(error instanceof Error ? error.message : '無法撤銷分享連結。');
    } finally {
      setWorking(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(issued);
      setCopied(true);
    } catch {
      setError('無法自動複製，請手動選取網址。');
    }
  }

  return <section className="asset-shares">
    <h3>限時分享連結</h3>
    <p className="asset-muted">不需要登入就能下載這個版本的原始檔。期限內有效，可隨時撤銷。</p>
    {error && <p className="asset-error" role="alert">{error}</p>}

    {issued && <div className="asset-share-issued">
      <p><TriangleAlert size={15} aria-hidden="true" /> 這串網址只會顯示這一次，關閉後無法再取得。</p>
      <code>{issued}</code>
      <div className="asset-actions">
        <button type="button" className="asset-primary" onClick={() => void copy()}>
          {copied ? <Check size={15} /> : <Copy size={15} />}{copied ? '已複製' : '複製網址'}
        </button>
        <button type="button" className="asset-secondary" onClick={() => setIssued('')}>我已保存</button>
      </div>
      <p className="asset-muted">把網址中的 /zh/ 換成 /en/ 就是英文版頁面。</p>
    </div>}

    <div className="asset-share-form">
      <label className="asset-field">有效期限
        <select value={hours} disabled={disabled || working} onChange={event => setHours(Number(event.target.value))}>
          {shareHourOptions.map(option => <option key={option} value={option}>{shareHourLabels[option]}</option>)}
        </select>
      </label>
      <label className="asset-field">開啟次數上限
        <input type="number" min={1} max={10000} inputMode="numeric" placeholder="不限"
          value={maxOpens} disabled={disabled || working} onChange={event => setMaxOpens(event.target.value)} />
      </label>
      <label className="asset-field">備註（只有你看得到）
        <input type="text" maxLength={120} placeholder="例如：某公司面試"
          value={label} disabled={disabled || working} onChange={event => setLabel(event.target.value)} />
      </label>
      <button type="button" className="asset-primary" disabled={disabled || working} onClick={() => void create()}>
        <Link2 size={16} />{working ? '處理中' : '建立連結'}
      </button>
    </div>

    {shares.length > 0 && <ul className="asset-share-list">
      {shares.map(share => {
        const state = stateOf(share);
        return <li key={share.id}>
          <span>
            <strong>{share.label || '未命名連結'}</strong>
            <small>
              {state.label} · 到期 {when(share.expires_at)} · 已開啟 {share.opens}
              {share.max_opens != null ? ` / ${share.max_opens}` : ''} 次
              {share.last_opened_at ? ` · 最後開啟 ${when(share.last_opened_at)}` : ''}
            </small>
          </span>
          {state.live && <button type="button" className="asset-icon" title={`撤銷 ${share.label || '這個連結'}`}
            aria-label={`撤銷 ${share.label || '這個連結'}`} disabled={disabled || working} onClick={() => void revoke(share)}>
            <Link2Off size={16} />
          </button>}
        </li>;
      })}
    </ul>}
  </section>;
}
