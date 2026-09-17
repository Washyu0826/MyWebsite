import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Container } from '@/components/container';
import { adminDb } from '@/lib/db/admin';
import { getProfile } from '@/lib/db/profile';
import { DeleteFileForm, ProfilePhotoForm, UploadFileForm } from './file-manager-forms';
import { storageBuckets, type StorageBucket } from './storage-config';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'File Manager Admin',
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type StorageItem = {
  name: string;
  path: string;
  publicUrl: string;
  size: number | null;
  updatedAt: string | null;
  contentType: string | null;
  isFolder: boolean;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseBucket(value: string | undefined): StorageBucket {
  return storageBuckets.includes(value as StorageBucket) ? (value as StorageBucket) : 'media';
}

function cleanPrefix(value: string | undefined) {
  return (value || '')
    .replace(/\\/g, '/')
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part && part !== '.' && part !== '..')
    .join('/');
}

function formatBytes(value: number | null) {
  if (value === null) return '資料夾';
  if (value < 1024) return `${value} B`;
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function parentPrefix(prefix: string) {
  const parts = prefix.split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
}

async function listStorageItems(bucket: StorageBucket, prefix: string) {
  const db = adminDb();
  const { data, error } = await db.storage.from(bucket).list(prefix || undefined, {
    limit: 100,
    sortBy: { column: 'updated_at', order: 'desc' },
  });
  if (error) throw error;

  return (data || []).map((item) => {
    const metadata = item.metadata as Record<string, unknown> | null;
    const isFolder = !item.id && !metadata;
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    const { data: urlData } = db.storage.from(bucket).getPublicUrl(path);

    return {
      name: item.name,
      path,
      publicUrl: urlData.publicUrl,
      size: typeof metadata?.size === 'number' ? metadata.size : null,
      updatedAt: item.updated_at || item.created_at || null,
      contentType: typeof metadata?.mimetype === 'string' ? metadata.mimetype : null,
      isFolder,
    } satisfies StorageItem;
  });
}

export default async function FileManagerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const bucket = parseBucket(firstValue(params?.bucket));
  const prefix = cleanPrefix(firstValue(params?.prefix));
  let files: StorageItem[] = [];
  let loadError = '';
  let profile: Awaited<ReturnType<typeof getProfile>> | null = null;
  let profileError = '';

  try {
    [files, profile] = await Promise.all([listStorageItems(bucket, prefix), getProfile()]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Unable to load files.';
    try {
      profile = await getProfile();
    } catch (profileLoadError) {
      profileError = profileLoadError instanceof Error ? profileLoadError.message : 'Unable to load profile.';
    }
  }

  const parent = parentPrefix(prefix);

  return <Container className="admin-page admin-file-page">
    <header className="admin-heading">
      <p className="text-meta text-graphite">Admin</p>
      <h1>檔案管理</h1>
      <p>管理 Supabase Storage 的公開素材與履歷檔案。上傳和刪除都需要管理密碼。</p>
    </header>

    <section className="admin-panel" aria-labelledby="file-browser">
      <div className="admin-panel-heading">
        <div>
          <h2 id="file-browser">檔案列表</h2>
          <p>{bucket}/{prefix || '(root)'}</p>
        </div>
        <Link className="admin-secondary-link" href="/admin/resume">履歷上傳頁</Link>
      </div>

      <form className="admin-filter-form">
        <label>
          <span>Bucket</span>
          <select name="bucket" defaultValue={bucket}>
            {storageBuckets.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label>
          <span>資料夾 prefix</span>
          <input name="prefix" defaultValue={prefix} placeholder="例如 projects/demo" />
        </label>
        <button className="admin-button" type="submit">切換</button>
      </form>

      {prefix ? <p className="admin-path-nav">
        <Link href={`/admin/files?bucket=${bucket}&prefix=${encodeURIComponent(parent)}`}>上一層</Link>
      </p> : null}

      {loadError ? <p className="admin-error">{loadError}</p> : <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>名稱</th>
              <th>大小</th>
              <th>類型</th>
              <th>更新時間</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {files.length ? files.map((file) => <tr key={file.path}>
              <td>
                {file.isFolder
                  ? <Link href={`/admin/files?bucket=${bucket}&prefix=${encodeURIComponent(file.path)}`}>{file.name}/</Link>
                  : <a href={file.publicUrl} target="_blank" rel="noreferrer">{file.name}</a>}
                <span>{file.path}</span>
              </td>
              <td>{formatBytes(file.size)}</td>
              <td>{file.contentType || '-'}</td>
              <td>{formatDate(file.updatedAt)}</td>
              <td>
                {file.isFolder ? null : <DeleteFileForm bucket={bucket} path={file.path} />}
              </td>
            </tr>) : <tr>
              <td colSpan={5}>這裡目前沒有檔案。</td>
            </tr>}
          </tbody>
        </table>
      </div>}
    </section>

    <section className="admin-panel" aria-labelledby="profile-photo">
      <h2 id="profile-photo">更新個人照</h2>
      {profileError ? <p className="admin-error">{profileError}</p> : <div className="admin-current-photo">
        {profile?.avatar_url ? <Image src={profile.avatar_url} alt="目前個人照" width={128} height={128} sizes="128px" /> : <div aria-hidden="true" />}
        <p>{profile?.avatar_url ? '目前首頁正在使用這張個人照。' : '目前尚未設定個人照。'}</p>
      </div>}
      <ProfilePhotoForm />
    </section>

    <section className="admin-panel" aria-labelledby="file-upload">
      <h2 id="file-upload">上傳檔案</h2>
      <UploadFileForm bucket={bucket} prefix={prefix} />
    </section>
  </Container>;
}
