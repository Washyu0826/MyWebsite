import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Container } from '@/components/container';
import { requireAdminPage } from '@/lib/auth/admin';
import { adminDb } from '@/lib/db/admin';
import type { Profile } from '@/types/content';
import { ProfileForm } from './profile-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Profile Admin',
  robots: { index: false, follow: false },
};

async function getAdminProfile(): Promise<Profile | null> {
  const { data, error } = await adminDb().from('profile').select('*').eq('id', 1).maybeSingle();
  if (error) throw new Error(`無法載入個人資料：${error.message}`);
  return data;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '尚未設定';
  return new Date(value).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' });
}

export default async function ProfileAdminPage() {
  await requireAdminPage('/admin/profile');

  let profile: Profile | null = null;
  let loadError = '';
  try {
    profile = await getAdminProfile();
  } catch (error) {
    loadError = error instanceof Error ? error.message : '無法載入個人資料。';
  }

  return <Container className="admin-page">
    <header className="admin-heading">
      <p className="text-meta text-graphite">Admin</p>
      <h1>個人資料</h1>
      <p>編輯首頁與聯絡頁顯示的姓名、定位句、目前狀態、自介與 SEO 描述。個人照與履歷分別在檔案管理與履歷管理更新。</p>
    </header>

    <section className="admin-panel" aria-labelledby="profile-assets">
      <h2 id="profile-assets">個人照與履歷</h2>
      {loadError ? <p className="admin-error" role="status">{loadError}</p> : <>
        <div className="admin-current-photo">
          {profile?.avatar_url
            ? <Image src={profile.avatar_url} alt="目前個人照" width={128} height={128} sizes="128px" />
            : <div aria-hidden="true" />}
          <p>
            {profile?.avatar_url ? '目前首頁正在使用這張個人照。' : '目前尚未設定個人照。'}
            {' '}<Link className="text-[var(--indigo)] underline" href="/admin/files">到檔案管理更換個人照</Link>
          </p>
        </div>
        <dl className="admin-list">
          <div>
            <dt>中文履歷</dt>
            <dd>{profile?.resume_zh_url ? <a href={profile.resume_zh_url} target="_blank" rel="noreferrer">開啟目前中文履歷</a> : '尚未設定'}</dd>
          </div>
          <div>
            <dt>English 履歷</dt>
            <dd>{profile?.resume_en_url ? <a href={profile.resume_en_url} target="_blank" rel="noreferrer">開啟目前英文履歷</a> : '尚未設定'}</dd>
          </div>
          <div>
            <dt>履歷更新時間</dt>
            <dd>{formatDate(profile?.resume_updated_at)} · <Link href="/admin/resume">到履歷管理上傳新版</Link></dd>
          </div>
        </dl>
      </>}
    </section>

    <section className="admin-panel" aria-labelledby="profile-editor">
      <h2 id="profile-editor">基本資料</h2>
      {loadError
        ? <p className="admin-error" role="status">{loadError}</p>
        : <>
          {!profile ? <p className="mb-6 text-sm text-[var(--graphite)]">資料庫尚未有 profile 資料列，儲存時會自動建立。</p> : null}
          <p className="mb-6 text-sm text-[var(--graphite)]">最後更新：{formatDate(profile?.updated_at)}</p>
          <ProfileForm profile={profile} />
        </>}
    </section>
  </Container>;
}
