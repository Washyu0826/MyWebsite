import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('@/lib/db/admin', () => ({ adminDb: vi.fn() }));
vi.mock('@/lib/images', () => ({
  processUploadImage: vi.fn(),
  saveImageMeta: vi.fn().mockResolvedValue(true),
  getImageMeta: vi.fn().mockResolvedValue(null),
  getImageMetaMap: vi.fn().mockResolvedValue({}),
  deleteImageMeta: vi.fn().mockResolvedValue(true),
}));
import { adminDb } from '@/lib/db/admin';
import { processUploadImage } from '@/lib/images';
import { finishAssetUpload, publishAsset, revokePublication } from '@/lib/assets/server';
import type { AssetPublication, AssetVersion } from '@/lib/assets/model';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const original = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const actor = '11111111-1111-4111-8111-111111111111';
let version: AssetVersion;
let operation: AssetPublication;
let originalBytes: Uint8Array;
let publicBytes: Uint8Array | null;
let failDatabaseCommit: boolean;
let failRemove: boolean;
let removed: string[];
type StorageResult<T> = { data: T; error: { message: string; code?: string } | null };
let rpc: Mock<(name: string, args: Record<string, unknown>) => Promise<StorageResult<unknown>>>;
let upload: Mock<(path: string, bytes: Uint8Array) => Promise<StorageResult<object>>>;
let download: Mock<(bucket: string) => Promise<StorageResult<Blob | null>>>;

beforeEach(() => {
  originalBytes = original;
  publicBytes = null;
  failDatabaseCommit = false;
  failRemove = false;
  removed = [];
  version = {
    id: 'v',
    asset_id: 'a',
    owner_id: actor,
    request_id: 'r',
    version_no: 1,
    original_name: 'photo.jpg',
    object_path: 'original.jpg',
    mime_type: 'image/jpeg',
    size_bytes: original.length,
    sha256: null,
    status: 'pending',
    last_error: null,
    created_at: '',
    completed_at: null,
  };
  operation = {
    id: 'p',
    owner_id: actor,
    asset_id: 'a',
    version_id: 'v',
    request_id: 'publish-request',
    slot: 'avatar',
    bucket: 'media',
    object_path: 'library/a/p',
    expected_url: null,
    public_url: null,
    content_sha256: null,
    content_size: null,
    content_type: null,
    status: 'pending',
    last_error: null,
    revoked_at: null,
    purged_at: null,
    created_at: '',
    completed_at: null,
  };
  rpc = vi.fn(async (name, args) => {
    if (name === 'asset_finish_upload') {
      version = { ...version, status: 'ready', sha256: String(args.p_hash) };
      return { data: version, error: null };
    }
    if (name === 'asset_upload_error') return { data: null, error: null };
    if (name === 'asset_revoke_publication') {
      if (operation.status !== 'revoked') operation = { ...operation, status: 'revoked', revoked_at: 'now' };
      return { data: { ...operation }, error: null };
    }
    if (name === 'asset_publication_purged') {
      operation = { ...operation, purged_at: 'now' };
      return { data: { ...operation }, error: null };
    }
    if (name === 'asset_prepare_publish') return { data: { ...operation }, error: null };
    if (name === 'asset_publication_payload') {
      operation = {
        ...operation,
        content_sha256: String(args.p_hash),
        content_size: Number(args.p_size),
        content_type: String(args.p_mime),
      };
      return { data: { ...operation }, error: null };
    }
    if (name === 'asset_finish_publish') {
      if (failDatabaseCommit) {
        failDatabaseCommit = false;
        return { data: null, error: { code: '08006', message: 'Disconnected' } };
      }
      operation = { ...operation, public_url: String(args.p_url), status: 'complete' };
      return { data: { ...operation }, error: null };
    }
    throw new Error(`Unexpected RPC ${name}`);
  });
  download = vi.fn(async (bucket: string) => {
    const bytes = bucket === 'media' ? publicBytes : originalBytes;
    return bytes ? { data: new Blob([bytes.slice().buffer as ArrayBuffer]), error: null } : { data: null, error: { message: 'not found' } };
  });
  upload = vi.fn(async (_path, bytes: Uint8Array) => {
    publicBytes = bytes;
    return { data: {}, error: null };
  });
  const db = {
    from(table: string) {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        update() {
          return this;
        },
        delete() {
          return this;
        },
        async maybeSingle() {
          return { data: table === 'asset_versions' ? { ...version } : { deleted_at: null }, error: null };
        },
      };
    },
    rpc,
    storage: {
      from(bucket: string) {
        return {
          download: () => download(bucket),
          upload,
          remove: async (paths: string[]) => {
            if (failRemove) return { data: null, error: { message: 'storage down', code: '503' } };
            removed.push(...paths);
            publicBytes = null;
            return { data: paths.map(name => ({ name })), error: null };
          },
          getPublicUrl: () => ({ data: { publicUrl: `https://storage.example/storage/v1/object/public/${bucket}/library/a/p` } }),
        };
      },
    },
  };
  vi.mocked(adminDb).mockReturnValue(db as unknown as ReturnType<typeof adminDb>);
  vi.mocked(processUploadImage).mockResolvedValue({
    bytes: new Uint8Array([1, 2, 3, 4]),
    mime: 'image/webp',
    width: 200,
    height: 100,
    blurDataUrl: null,
    converted: true,
  });
});

describe('asset verification and publication recovery', () => {
  it('verifies downloaded bytes and records the server-computed SHA-256', async () => {
    await finishAssetUpload(actor, version.id);
    expect(rpc).toHaveBeenCalledWith(
      'asset_finish_upload',
      expect.objectContaining({ p_actor: actor, p_size: original.length, p_mime: 'image/jpeg', p_hash: hash(original) }),
    );
    const count = download.mock.calls.length;
    await finishAssetUpload(actor, version.id);
    expect(download).toHaveBeenCalledTimes(count);
  });
  it('rejects spoofed MIME and size before making a version ready', async () => {
    originalBytes = new TextEncoder().encode('%PDF-1.4');
    await expect(finishAssetUpload(actor, version.id)).rejects.toThrow('UPLOAD_MISMATCH');
    expect(rpc).toHaveBeenCalledWith('asset_upload_error', expect.objectContaining({ p_reject: true }));
    expect(rpc.mock.calls.some(call => call[0] === 'asset_finish_upload')).toBe(false);
  });
  it('keeps originals intact and freezes the separately optimized public payload', async () => {
    version = { ...version, status: 'ready', sha256: hash(original) };
    await publishAsset(actor, version.id, 'avatar', 'publish-request');
    expect(processUploadImage).toHaveBeenCalledWith(original, 'image/jpeg');
    expect(upload).toHaveBeenCalledWith(
      'library/a/p',
      new Uint8Array([1, 2, 3, 4]),
      expect.objectContaining({ upsert: false, contentType: 'image/webp' }),
    );
    expect(operation.content_sha256).toBe(hash(new Uint8Array([1, 2, 3, 4])));
    expect(originalBytes).toEqual(original);
  });
  it('reuses an uploaded public object after a failed database commit', async () => {
    version = { ...version, status: 'ready', sha256: hash(original) };
    failDatabaseCommit = true;
    await expect(publishAsset(actor, version.id, 'avatar', 'publish-request')).rejects.toThrow('Disconnected');
    expect(publicBytes).not.toBeNull();
    expect(operation.status).toBe('pending');
    await publishAsset(actor, version.id, 'avatar', 'publish-request');
    expect(upload).toHaveBeenCalledTimes(1);
    expect(processUploadImage).toHaveBeenCalledTimes(1);
    expect(operation.status).toBe('complete');
  });
  it('revokes a public copy in two steps and keeps a retry path when Storage removal fails', async () => {
    operation = { ...operation, status: 'complete', public_url: 'https://storage.example/x' };
    failRemove = true;
    await expect(revokePublication(actor, operation.id)).rejects.toThrow('OBJECT_REMOVE_FAILED');
    expect(operation.status).toBe('revoked');
    expect(operation.purged_at).toBeNull();
    failRemove = false;
    const result = await revokePublication(actor, operation.id);
    expect(removed).toEqual(['library/a/p']);
    expect(result.purged_at).toBe('now');
    const calls = rpc.mock.calls.filter(call => call[0] === 'asset_publication_purged').length;
    await revokePublication(actor, operation.id);
    expect(removed).toHaveLength(1);
    expect(rpc.mock.calls.filter(call => call[0] === 'asset_publication_purged')).toHaveLength(calls);
  });
  it('will not publish when an original has changed after verification', async () => {
    version = { ...version, status: 'ready', sha256: '0'.repeat(64) };
    await expect(publishAsset(actor, version.id, 'avatar', 'publish-request')).rejects.toThrow('UPLOAD_MISMATCH');
    expect(upload).not.toHaveBeenCalled();
  });
});
