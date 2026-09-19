import type { Metadata } from 'next';
import { requireAdminPage } from '@/lib/auth/admin';
import { AssetWorkspace } from '@/components/admin/asset-workspace';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Asset Library', robots: { index: false, follow: false } };
export default async function FileManagerPage() {
  await requireAdminPage('/admin/files');
  return <AssetWorkspace />;
}
