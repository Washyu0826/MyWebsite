'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copy, Check } from 'lucide-react';
import { Button } from './ui/button';
export function CopyValue({ value, label, copiedLabel }: { value: string; label: string; copiedLabel?: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const t = useTranslations('Contact');
  async function copy() {
    try { await navigator.clipboard.writeText(value); setStatus('copied'); }
    catch { setStatus('failed'); }
  }
  return <div><Button variant="outline" onClick={copy}>{status === 'copied' ? <Check size={16} /> : <Copy size={16} />}{status === 'copied' ? copiedLabel || t('copied') : label}</Button>
    <span role="status" className={status === 'failed' ? 'mt-2 block text-meta' : 'sr-only'}>{status === 'failed' ? t('copyFailed') : status === 'copied' ? t('copied') : ''}</span></div>;
}

export function CopyEmail({ email }: { email: string }) {
  const t = useTranslations('Contact');
  return <CopyValue value={email} label={t('copy')} />;
}
