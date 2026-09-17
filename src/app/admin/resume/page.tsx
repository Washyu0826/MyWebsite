import type { Metadata } from 'next';
import { requireAdminPage } from '@/lib/auth/admin';
import { getProfile } from '@/lib/db/profile';
import { Container } from '@/components/container';
import { ResumeUploadForm } from './resume-upload-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Resume Admin',
  robots: { index: false, follow: false },
};

export default async function ResumeAdminPage() {
  await requireAdminPage('/admin/resume');
  let profile: Awaited<ReturnType<typeof getProfile>> | null = null;
  let loadError = '';
  try {
    profile = await getProfile();
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Unable to load profile.';
  }

  return <Container className="admin-page">
    <header className="admin-heading">
      <p className="text-meta text-graphite">Admin</p>
      <h1>履歷管理</h1>
      <p>上傳新的中英文 PDF 後，網站的履歷按鈕會指向最新檔案，舊檔會自動從 Storage 刪除。</p>
    </header>

    <section className="admin-panel" aria-labelledby="current-resume">
      <h2 id="current-resume">目前履歷</h2>
      {loadError ? <p className="admin-error">{loadError}</p> : <dl className="admin-list">
        <div><dt>中文</dt><dd>{profile?.resume_zh_url ? <a href={profile.resume_zh_url}>開啟目前中文履歷</a> : '尚未設定'}</dd></div>
        <div><dt>English</dt><dd>{profile?.resume_en_url ? <a href={profile.resume_en_url}>Open current English resume</a> : 'Not set'}</dd></div>
        <div><dt>更新時間</dt><dd>{profile?.resume_updated_at ? new Date(profile.resume_updated_at).toLocaleString('zh-TW') : '尚未設定'}</dd></div>
      </dl>}
    </section>

    <section className="admin-panel" aria-labelledby="upload-resume">
      <h2 id="upload-resume">上傳新版</h2>
      <ResumeUploadForm />
    </section>
  </Container>;
}
