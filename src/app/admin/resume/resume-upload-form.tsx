'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AssetUpload } from '@/components/admin/asset-upload';

export function ResumeUploadForm() {
  const [locale, setLocale] = useState<'zh' | 'en'>('zh');
  const router = useRouter();
  return <div className="admin-form">
    <label><span>履歷語言</span><select value={locale} onChange={event => setLocale(event.target.value as 'zh' | 'en')}>
      <option value="zh">中文履歷</option><option value="en">English resume</option>
    </select></label>
    <AssetUpload key={locale} slot={locale === 'zh' ? 'resume_zh' : 'resume_en'} onComplete={() => router.refresh()} />
  </div>;
}
