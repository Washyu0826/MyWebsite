'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copy, Check } from 'lucide-react';
import { cue } from '@/lib/audio/cue';
import { Button } from './ui/button';
export function CopyValue({ value, label, copiedLabel }: { value: string; label: string; copiedLabel?: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  // Bumped on every success so the tick remounts and draws itself again on a repeat copy.
  const [run, setRun] = useState(0);
  const timer = useRef<number>(undefined);
  const t = useTranslations('Contact');
  const copied = status === 'copied';
  const confirmation = copiedLabel || t('copied');
  useEffect(() => () => window.clearTimeout(timer.current), []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus('copied'); setRun(current => current + 1);
      cue('copy'); // only on the success path: a failed copy is reported, not congratulated
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setStatus('idle'), 1900);
    }
    catch { window.clearTimeout(timer.current); setStatus('failed'); }
  }
  return <div><div className="copy-field">
    <Button variant="outline" onClick={copy}>{copied ? <Check key={run} size={16} className="copy-check" /> : <Copy size={16} />}{label}</Button>
    {/* Visual echo only: the live region below is what assistive technology announces. */}
    <span className="copy-confirm" data-state={status} aria-hidden="true">{confirmation}</span>
  </div>
    <span role="status" className={status === 'failed' ? 'mt-2 block text-meta' : 'sr-only'}>{status === 'failed' ? t('copyFailed') : copied ? confirmation : ''}</span></div>;
}

export function CopyEmail({ email }: { email: string }) {
  const t = useTranslations('Contact');
  return <CopyValue value={email} label={t('copy')} />;
}
