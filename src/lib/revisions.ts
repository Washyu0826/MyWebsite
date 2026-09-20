import 'server-only';
import { adminDb } from '@/lib/db/admin';
import { diffSnapshots, revisionFields, snapshotText, type FieldDiff } from '@/lib/diff';
import type { Post } from '@/types/content';

export type RevisionSnapshot = Record<string, unknown>;
export type PostRevision = {
  id: string;
  post_id: string;
  revision: number;
  snapshot: RevisionSnapshot;
  actor_id: string | null;
  reason: 'save' | 'restore';
  created_at: string;
};
/** What the list shows: metadata plus the labels of the fields this revision changed. */
export type RevisionSummary = { id: string; revision: number; reason: 'save' | 'restore'; created_at: string; changed: string[] };

/** The editable fields of a post, in the shape both the snapshot and the editor use. */
export function revisionSnapshot(post: Partial<Post>): RevisionSnapshot {
  const snapshot: RevisionSnapshot = {};
  for (const { field } of revisionFields) {
    const value = (post as Record<string, unknown>)[field];
    snapshot[field] = value === undefined ? null : value;
  }
  return snapshot;
}

/**
 * Appends a revision. Never throws: a history write must not fail a save the database already
 * accepted, and a missing table only means the migration has not been applied yet.
 */
export async function saveRevision(actor: string | null, postId: string, snapshot: RevisionSnapshot, reason: 'save' | 'restore' = 'save') {
  try {
    const { error } = await adminDb().rpc('post_save_revision', { p_actor: actor, p_post: postId, p_snapshot: snapshot, p_reason: reason });
    return !error;
  } catch {
    return false;
  }
}

export async function listRevisions(postId: string, limit = 30): Promise<RevisionSummary[]> {
  const { data, error } = await adminDb()
    .from('post_revisions')
    .select('id, revision, snapshot, reason, created_at')
    .eq('post_id', postId)
    .order('revision', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  const rows = data as unknown as PostRevision[];
  // Each entry is described by what it changed relative to the revision before it; the oldest one
  // in the window has nothing to compare against, so it is labelled as the starting point.
  return rows.map((row, index) => {
    const previous = rows[index + 1];
    return {
      id: row.id,
      revision: row.revision,
      reason: row.reason,
      created_at: row.created_at,
      changed: previous ? diffSnapshots(previous.snapshot, row.snapshot).map(diff => diff.label) : [],
    };
  });
}

export async function getRevision(postId: string, revision: number): Promise<PostRevision | null> {
  const { data, error } = await adminDb()
    .from('post_revisions')
    .select('*')
    .eq('post_id', postId)
    .eq('revision', revision)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as PostRevision;
}

/** What restoring this revision would change about the article as it stands now. */
export async function diffAgainstCurrent(postId: string, revision: number): Promise<{ fields: FieldDiff[]; createdAt: string } | null> {
  const db = adminDb();
  const [stored, current] = await Promise.all([
    getRevision(postId, revision),
    db.from('posts').select('*').eq('id', postId).maybeSingle(),
  ]);
  if (!stored || current.error || !current.data) return null;
  return { fields: diffSnapshots(stored.snapshot, revisionSnapshot(current.data)), createdAt: stored.created_at };
}

/** Snapshot value coerced back to the column type the posts table expects. */
export function snapshotToColumn(field: string, value: unknown): unknown {
  if (field === 'tags') return Array.isArray(value) ? value.map(item => String(item)).slice(0, 12) : [];
  if (field === 'reading_minutes') {
    const minutes = Number(value);
    return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : null;
  }
  if (field === 'published_at' || field === 'cover_url') return snapshotText(value) || null;
  return snapshotText(value);
}
