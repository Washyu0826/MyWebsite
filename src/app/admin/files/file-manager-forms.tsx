'use client';

import { useRouter } from 'next/navigation';
import { AssetUpload } from '@/components/admin/asset-upload';

export function ProfilePhotoForm() {
  const router = useRouter();
  return <AssetUpload slot="avatar" onComplete={() => router.refresh()} />;
}
