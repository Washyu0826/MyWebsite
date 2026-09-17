export const storageBuckets = ['media', 'resume'] as const;

export type StorageBucket = (typeof storageBuckets)[number];

export const allowedStorageMimeTypes: Record<StorageBucket, string[]> = {
  media: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'],
  resume: ['application/pdf'],
};
