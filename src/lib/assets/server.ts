import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { revalidatePath, revalidateTag } from 'next/cache';
import { adminDb } from '@/lib/db/admin';
import { sniffMimeType } from '@/lib/uploads';
import { processUploadImage, saveImageMeta, deleteImageMeta, getImageMeta, getImageMetaMap } from '@/lib/images';
import { assetMaxBytes, privateBucket, type AssetVersion, type AssetPublication, type AssetList, type AssetDetail, type AssetReference, type PublishedList, type PublishSlot, validateAssetInput, isPublishSlot } from './model';

function checked<T>(result: { data: T; error: { message: string; code?: string } | null }): NonNullable<T> {
  if (result.error) throw Object.assign(new Error(/bucket not found/i.test(result.error.message) ? 'BUCKET_NOT_FOUND' : result.error.message), { code: result.error.code });
  if (result.data == null) throw new Error('ASSET_NOT_FOUND');
  return result.data as NonNullable<T>;
}

export async function listAssets(actor: string, params: URLSearchParams): Promise<AssetList> {
  const db = adminDb();
  const page = Math.floor(Math.max(1, Math.min(10000, Number(params.get('page')) || 1)));
  const query = (params.get('q') || '').slice(0, 120).replace(/[\\%_]/g, '\\$&');
  let selection = db.from('assets').select('*', { count: 'exact' }).eq('owner_id', actor);
  selection = params.get('view') === 'trash' ? selection.not('deleted_at', 'is', null) : selection.is('deleted_at', null);
  if (query) selection = selection.ilike('name', `%${query}%`);
  const listed = await selection.order('updated_at', { ascending: false }).order('id').range((page - 1) * 25, page * 25 - 1);
  const rows = checked(listed);
  const currentIds = rows.flatMap(row => row.current_version_id ? [row.current_version_id] : []);
  const [versions, published, usage] = await Promise.all([
    currentIds.length ? db.from('asset_versions').select('*').eq('owner_id', actor).in('id', currentIds) : Promise.resolve({ data: [], error: null }),
    rows.length ? db.from('asset_publications').select('asset_id').eq('owner_id', actor).eq('status', 'complete').in('asset_id', rows.map(row => row.id)) : Promise.resolve({ data: [], error: null }),
    db.rpc('asset_library_usage'),
  ]);
  const current = checked(versions);
  const visible = new Set(checked(published).map(row => row.asset_id));
  return { items: rows.map(row => ({ ...row, current: current.find(version => version.id === row.current_version_id) ?? null, published: visible.has(row.id) })), count: listed.count || 0, page, usedBytes: checked(usage) };
}

export async function assetDetail(actor: string, id: string): Promise<AssetDetail> {
  const db = adminDb();
  const asset = checked(await db.from('assets').select('*').eq('owner_id', actor).eq('id', id).maybeSingle());
  const [versions, publications, events, references] = await Promise.all([
    db.from('asset_versions').select('*').eq('asset_id', id).eq('owner_id', actor).order('version_no', { ascending: false }),
    db.from('asset_publications').select('*').eq('asset_id', id).eq('owner_id', actor).order('created_at', { ascending: false }),
    db.from('asset_events').select('*').eq('asset_id', id).eq('actor_id', actor).order('id', { ascending: false }).limit(100),
    db.rpc('asset_references', { p_actor: actor, p_asset: id }),
  ]);
  return { asset, versions: checked(versions), publications: checked(publications), events: checked(events), references: checked(references) as unknown as AssetReference[] };
}

// Completed public copies, newest first, for the editors' asset picker. Only public URLs leave here.
export async function listPublished(actor: string, params: URLSearchParams): Promise<PublishedList> {
  const db = adminDb();
  const page = Math.floor(Math.max(1, Math.min(10000, Number(params.get('page')) || 1)));
  const query = (params.get('q') || '').slice(0, 120).replace(/[\\%_]/g, '\\$&');
  let ids: string[] | null = null;
  if (query) {
    ids = checked(await db.from('assets').select('id').eq('owner_id', actor).ilike('name', `%${query}%`).limit(200)).map(row => row.id);
    if (!ids.length) return { items: [], count: 0, page };
  }
  let selection = db.from('asset_publications').select('*', { count: 'exact' }).eq('owner_id', actor).eq('status', 'complete');
  if (params.get('kind') === 'image') selection = selection.eq('bucket', 'media');
  if (ids) selection = selection.in('asset_id', ids);
  const listed = await selection.order('completed_at', { ascending: false }).order('id').range((page - 1) * 25, page * 25 - 1);
  const rows = checked(listed);
  const assetIds = [...new Set(rows.map(row => row.asset_id))];
  const [assets, meta] = await Promise.all([
    assetIds.length ? db.from('assets').select('id,name').in('id', assetIds) : Promise.resolve({ data: [], error: null }),
    getImageMetaMap(rows.map(row => row.public_url)),
  ]);
  const names = new Map(checked(assets).map(row => [row.id, row.name]));
  return {
    items: rows.flatMap(row => row.public_url ? [{
      id: row.id, asset_id: row.asset_id, name: names.get(row.asset_id) ?? row.object_path, slot: row.slot, public_url: row.public_url,
      mime_type: row.content_type, size: row.content_size, completed_at: row.completed_at ?? row.created_at,
      width: meta[row.public_url]?.width ?? null, height: meta[row.public_url]?.height ?? null,
    }] : []),
    count: listed.count || 0, page,
  };
}

export async function beginAssetUpload(actor: string, input: Record<string, unknown>) {
  const value = validateAssetInput(input);
  const db = adminDb();
  if (input.slot != null && !isPublishSlot(input.slot)) throw new Error('INVALID_SLOT');
  if (input.slot === 'avatar' && value.mime === 'application/pdf' || typeof input.slot === 'string' && input.slot.startsWith('resume_') && value.mime !== 'application/pdf') throw new Error('INVALID_TYPE');
  // Photo/resume replacements stay in the same version history, including retried requests.
  if (!value.assetId && isPublishSlot(input.slot) && input.slot !== 'public') {
    const existing = await db.from('asset_versions').select('asset_id').eq('owner_id', actor).eq('request_id', value.requestId).maybeSingle();
    if (existing.error) checked(existing);
    if (existing.data) value.assetId = existing.data.asset_id;
    else {
      const profile = checked(await db.from('profile').select('avatar_url,resume_zh_url,resume_en_url').eq('id', 1).single());
      const url = input.slot === 'avatar' ? profile.avatar_url : input.slot === 'resume_zh' ? profile.resume_zh_url : profile.resume_en_url;
      if (url) {
        const published = await db.from('asset_publications').select('asset_id').eq('owner_id', actor).eq('slot', input.slot).eq('public_url', url).eq('status', 'complete').limit(1).maybeSingle();
        if (published.error) checked(published);
        value.assetId = published.data?.asset_id;
      }
    }
  }
  const version = checked(await db.rpc('asset_begin_upload', { p_actor: actor, p_request: value.requestId, p_name: value.name, p_mime: value.mime, p_size: value.size, p_asset: value.assetId })) as unknown as AssetVersion;
  if (version.status !== 'pending') return { version, token: null, endpoint: '' };
  const signed = checked(await db.storage.from(privateBucket).createSignedUploadUrl(version.object_path, { upsert: false }));
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  if (url.hostname.endsWith('.supabase.co')) url.hostname = url.hostname.replace('.supabase.co', '.storage.supabase.co');
  return { version, token: signed.token, endpoint: `${url.origin}/storage/v1/upload/resumable` };
}

async function versionFor(actor: string, id: string) {
  const db = adminDb();
  const version = checked(await db.from('asset_versions').select('*').eq('id', id).eq('owner_id', actor).maybeSingle());
  const asset = checked(await db.from('assets').select('deleted_at').eq('id', version.asset_id).eq('owner_id', actor).maybeSingle());
  if (asset.deleted_at) throw new Error('ASSET_TRASHED');
  return version;
}

export async function finishAssetUpload(actor: string, id: string): Promise<AssetVersion> {
  const db = adminDb();
  const version = await versionFor(actor, id);
  if (version.status === 'ready') return version;
  if (version.status === 'rejected') throw new Error('UPLOAD_REJECTED');
  const downloaded = await db.storage.from(privateBucket).download(version.object_path);
  if (downloaded.error || !downloaded.data) {
    checked(await db.rpc('asset_upload_error', { p_actor: actor, p_version: id, p_error: 'OBJECT_NOT_AVAILABLE' }).then(result => ({ ...result, data: true })));
    throw new Error('OBJECT_NOT_AVAILABLE');
  }
  const blob = downloaded.data;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const mime = sniffMimeType(bytes);
  if (blob.size > assetMaxBytes || blob.size !== version.size_bytes || mime !== version.mime_type) {
    checked(await db.rpc('asset_upload_error', { p_actor: actor, p_version: id, p_error: 'UPLOAD_MISMATCH', p_reject: true }).then(result => ({ ...result, data: true })));
    throw new Error('UPLOAD_MISMATCH');
  }
  return checked(await db.rpc('asset_finish_upload', { p_actor: actor, p_version: id, p_size: blob.size, p_mime: mime, p_hash: createHash('sha256').update(bytes).digest('hex') })) as unknown as AssetVersion;
}

export async function changeAsset(actor: string, id: string, action: string, value?: string) {
  return checked(await adminDb().rpc('asset_change', { p_actor: actor, p_asset: id, p_action: action, p_value: value }));
}

export async function previewAsset(actor: string, versionId: string) {
  const version = await versionFor(actor, versionId);
  if (version.status !== 'ready') throw new Error('VERSION_NOT_READY');
  return checked(await adminDb().storage.from(privateBucket).createSignedUrl(version.object_path, 60)).signedUrl;
}

export async function listAssetEvents(actor: string, page: number) {
  const result = await adminDb().from('asset_events').select('*', { count: 'exact' }).eq('actor_id', actor)
    .order('id', { ascending: false }).range((page - 1) * 25, page * 25 - 1);
  return { events: checked(result), count: result.count || 0, page };
}

export async function listLegacyAssets(bucket: string, prefix: string, page: number) {
  if (!['media', 'resume'].includes(bucket) || prefix.split('/').some(part => part === '..') || prefix.length > 500) throw new Error('INVALID_REQUEST');
  const db = adminDb();
  const rows = checked(await db.storage.from(bucket).list(prefix, { limit: 26, offset: (page - 1) * 25, sortBy: { column: 'name', order: 'asc' } }));
  return { more: rows.length > 25, items: rows.slice(0, 25).map(row => {
    const path = prefix ? `${prefix}/${row.name}` : row.name;
    return { name: row.name, folder: !row.id, path, url: db.storage.from(bucket).getPublicUrl(path).data.publicUrl, size: Number(row.metadata?.size) || 0 };
  }) };
}

function invalidateProfile() {
  revalidateTag('profile');
  for (const path of ['/en', '/zh', '/en/contact', '/zh/contact', '/admin/files', '/admin/resume']) revalidatePath(path);
}

export async function publishAsset(actor: string, versionId: string, slot: PublishSlot, requestId: string) {
  const db = adminDb();
  const version = await versionFor(actor, versionId);
  let operation = checked(await db.rpc('asset_prepare_publish', { p_actor: actor, p_version: versionId, p_slot: slot, p_request: requestId })) as unknown as AssetPublication;
  if (operation.status === 'conflict') throw new Error('PROFILE_CHANGED');
  if (operation.status === 'complete') { invalidateProfile(); return { ...operation, imageMeta: await getImageMeta(operation.public_url) }; }
  try {
    // An immutable destination makes retries safe even after Storage succeeded but DB did not.
    const existing = await db.storage.from(operation.bucket).download(operation.object_path);
    if (existing.error || !existing.data) {
      const blob = checked(await db.storage.from(privateBucket).download(version.object_path));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (createHash('sha256').update(bytes).digest('hex') !== version.sha256) throw new Error('UPLOAD_MISMATCH');
      const processed = version.mime_type.startsWith('image/') ? await processUploadImage(bytes, version.mime_type) : null;
      const body = processed?.bytes ?? bytes;
      const mime = processed?.mime ?? version.mime_type;
      operation = checked(await db.rpc('asset_publication_payload', { p_actor: actor, p_operation: operation.id, p_hash: createHash('sha256').update(body).digest('hex'), p_mime: mime, p_size: body.byteLength })) as unknown as AssetPublication;
      const upload = await db.storage.from(operation.bucket).upload(operation.object_path, body, { contentType: mime, upsert: false, cacheControl: '3600' });
      if (upload.error) {
        const raced = checked(await db.storage.from(operation.bucket).download(operation.object_path));
        if (createHash('sha256').update(new Uint8Array(await raced.arrayBuffer())).digest('hex') !== operation.content_sha256) throw new Error('UPLOAD_MISMATCH');
      }
      if (processed) await saveImageMeta({ publicUrl: db.storage.from(operation.bucket).getPublicUrl(operation.object_path).data.publicUrl, bucket: operation.bucket, objectPath: operation.object_path, width: processed.width, height: processed.height, blurDataUrl: processed.blurDataUrl, mimeType: mime, byteSize: body.byteLength });
    } else if (createHash('sha256').update(new Uint8Array(await existing.data.arrayBuffer())).digest('hex') !== operation.content_sha256) throw new Error('UPLOAD_MISMATCH');
    const { data } = db.storage.from(operation.bucket).getPublicUrl(operation.object_path);
    const result = checked(await db.rpc('asset_finish_publish', { p_actor: actor, p_operation: operation.id, p_url: data.publicUrl })) as unknown as AssetPublication;
    if (result.status === 'conflict') throw new Error('PROFILE_CHANGED');
    invalidateProfile();
    return { ...result, imageMeta: await getImageMeta(result.public_url) };
  } catch (error) {
    await db.from('asset_publications').update({ last_error: error instanceof Error && error.message === 'PROFILE_CHANGED' ? 'PROFILE_CHANGED' : 'PUBLISH_RETRY_NEEDED' }).eq('id', operation.id).eq('status', 'pending');
    throw error;
  }
}

// Two steps on purpose: the row flips to 'revoked' first, so listings, the picker and the reference
// scan drop it even if the object removal below fails; a retry of the same action finishes the purge.
export async function revokePublication(actor: string, id: string) {
  const db = adminDb();
  let publication = checked(await db.rpc('asset_revoke_publication', { p_actor: actor, p_publication: id })) as unknown as AssetPublication;
  if (!publication.purged_at) {
    const removed = await db.storage.from(publication.bucket).remove([publication.object_path]);
    if (removed.error) {
      await db.from('asset_publications').update({ last_error: 'PURGE_RETRY_NEEDED' }).eq('id', id).eq('status', 'revoked');
      throw new Error('OBJECT_REMOVE_FAILED');
    }
    await deleteImageMeta(publication.public_url);
    publication = checked(await db.rpc('asset_publication_purged', { p_actor: actor, p_publication: id })) as unknown as AssetPublication;
  }
  invalidateProfile();
  return publication;
}

export async function uploadServerAsset(actor: string, file: File, slot?: PublishSlot) {
  if (!file.size || file.size > assetMaxBytes) throw new Error('INVALID_SIZE');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffMimeType(bytes);
  const { version } = await beginAssetUpload(actor, { requestId: randomUUID(), name: file.name, size: file.size, mime });
  checked(await adminDb().storage.from(privateBucket).upload(version.object_path, bytes, { contentType: version.mime_type, upsert: false }));
  const ready = await finishAssetUpload(actor, version.id);
  return slot ? publishAsset(actor, ready.id, slot, randomUUID()) : ready;
}
