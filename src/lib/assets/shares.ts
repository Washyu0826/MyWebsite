import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { adminDb } from '@/lib/db/admin';
import { privateBucket, shareTokenPattern, type AssetShare, type SharePeek } from './model';

/** 32 random bytes, URL-safe. Only its SHA-256 reaches the database. */
export function newShareToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: createHash('sha256').update(token).digest('hex') };
}

export function shareTokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function checked<T>(result: { data: T; error: { message: string; code?: string } | null }): NonNullable<T> {
  if (result.error) throw Object.assign(new Error(result.error.message), { code: result.error.code });
  if (result.data == null) throw new Error('ASSET_NOT_FOUND');
  return result.data as NonNullable<T>;
}

export async function listShares(actor: string, assetId: string): Promise<AssetShare[]> {
  const result = await adminDb().from('asset_shares').select('id,asset_id,version_id,label,expires_at,max_opens,opens,revoked_at,last_opened_at,created_at')
    .eq('owner_id', actor).eq('asset_id', assetId).order('created_at', { ascending: false }).limit(20);
  return checked(result) as AssetShare[];
}

/**
 * Creates a link and returns the only copy of its token. Nothing stores the plaintext, so a lost
 * link cannot be recovered; the caller has to show it once and then forget it too.
 */
export async function createShare(actor: string, input: { versionId: string; hours: number; maxOpens: number | null; label: string | null }) {
  const { token, hash } = newShareToken();
  const expires = new Date(Date.now() + input.hours * 3600_000).toISOString();
  const share = checked(await adminDb().rpc('asset_create_share', {
    p_actor: actor, p_version: input.versionId, p_hash: hash, p_expires: expires,
    p_max_opens: input.maxOpens, p_label: input.label,
  })) as unknown as AssetShare;
  return { share, token };
}

export async function revokeShare(actor: string, shareId: string) {
  return checked(await adminDb().rpc('asset_revoke_share', { p_actor: actor, p_share: shareId })) as unknown as AssetShare;
}

/** What the landing page shows. Never spends an open, and says nothing about other links. */
export async function peekShare(token: string): Promise<SharePeek> {
  if (!shareTokenPattern.test(token)) return { state: 'missing' };
  try {
    const result = await adminDb().rpc('asset_peek_share', { p_hash: shareTokenHash(token) });
    if (result.error || !result.data) return { state: 'missing' };
    return result.data as unknown as SharePeek;
  } catch {
    return { state: 'missing' };
  }
}

/**
 * Spends one open and returns a short-lived signed URL for the private original.
 *
 * The signature lives for 60 seconds, so revoking a link stops new opens immediately but cannot
 * recall a URL that was handed out moments earlier.
 */
export async function redeemShare(token: string): Promise<{ url: string; name: string } | null> {
  if (!shareTokenPattern.test(token)) return null;
  const db = adminDb();
  let redeemed: { object_path: string; name: string };
  try {
    const result = await db.rpc('asset_redeem_share', { p_hash: shareTokenHash(token) });
    if (result.error || !result.data) return null;
    redeemed = result.data as unknown as { object_path: string; name: string };
  } catch {
    return null;
  }
  const signed = await db.storage.from(privateBucket).createSignedUrl(redeemed.object_path, 60, { download: redeemed.name });
  if (signed.error || !signed.data) return null;
  return { url: signed.data.signedUrl, name: redeemed.name };
}
