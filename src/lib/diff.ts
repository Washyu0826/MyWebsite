// Line diff for the article revision viewer. Pure, no DOM and no dependencies, so it runs in the
// `tsx --test` suite and in the browser alike.

export type DiffRow = { type: 'same' | 'added' | 'removed'; text: string; before: number | null; after: number | null };
export type FieldDiff = { field: string; label: string; before: string; after: string; rows: DiffRow[]; added: number; removed: number };

/** Longest common subsequence over lines, as a table of shared-prefix lengths. */
function lcsTable(a: string[], b: string[]): Uint32Array[] {
  const table: Uint32Array[] = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    const row = table[i];
    const next = table[i + 1];
    for (let j = b.length - 1; j >= 0; j--) {
      row[j] = a[i] === b[j] ? next[j + 1] + 1 : Math.max(next[j], row[j + 1]);
    }
  }
  return table;
}

/**
 * Line-by-line difference between two texts. Both sides keep their own line numbers so the viewer can
 * show them side by side; a changed line appears as a removal followed by an addition.
 *
 * The table is O(lines²) in memory, so very large texts fall back to "everything replaced" rather
 * than allocating hundreds of megabytes for a diff nobody can read anyway.
 */
export function diffLines(before: string, after: string, maxLines = 4000): DiffRow[] {
  const a = before.length ? before.replace(/\r\n/g, '\n').split('\n') : [];
  const b = after.length ? after.replace(/\r\n/g, '\n').split('\n') : [];
  if (a.length > maxLines || b.length > maxLines) {
    return [
      ...a.map<DiffRow>((text, index) => ({ type: 'removed', text, before: index + 1, after: null })),
      ...b.map<DiffRow>((text, index) => ({ type: 'added', text, before: null, after: index + 1 })),
    ];
  }
  const table = lcsTable(a, b);
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      rows.push({ type: 'same', text: a[i], before: i + 1, after: j + 1 });
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      rows.push({ type: 'removed', text: a[i], before: i + 1, after: null });
      i++;
    } else {
      rows.push({ type: 'added', text: b[j], before: null, after: j + 1 });
      j++;
    }
  }
  while (i < a.length) rows.push({ type: 'removed', text: a[i], before: ++i, after: null });
  while (j < b.length) rows.push({ type: 'added', text: b[j], before: null, after: ++j });
  return rows;
}

/** Drops long runs of unchanged lines, keeping `context` lines around each change. */
export function collapseUnchanged(rows: DiffRow[], context = 2): (DiffRow | { type: 'skipped'; count: number })[] {
  const keep = new Set<number>();
  rows.forEach((row, index) => {
    if (row.type === 'same') return;
    for (let at = index - context; at <= index + context; at++) if (at >= 0 && at < rows.length) keep.add(at);
  });
  const output: (DiffRow | { type: 'skipped'; count: number })[] = [];
  let skipped = 0;
  rows.forEach((row, index) => {
    if (keep.has(index)) {
      if (skipped) {
        output.push({ type: 'skipped', count: skipped });
        skipped = 0;
      }
      output.push(row);
    } else {
      skipped++;
    }
  });
  if (skipped) output.push({ type: 'skipped', count: skipped });
  return output;
}

/** Fields a reader cares about, in reading order, with the label the admin shows. */
export const revisionFields: { field: string; label: string }[] = [
  { field: 'title_zh', label: '標題（中文）' },
  { field: 'title_en', label: '標題（English）' },
  { field: 'slug', label: '網址代稱' },
  { field: 'status', label: '狀態' },
  { field: 'published_at', label: '發布時間' },
  { field: 'excerpt_zh', label: '摘要（中文）' },
  { field: 'excerpt_en', label: '摘要（English）' },
  { field: 'body_zh', label: '內文（中文）' },
  { field: 'body_en', label: '內文（English）' },
  { field: 'cover_url', label: '封面圖片' },
  { field: 'cover_alt_zh', label: '封面替代文字（中文）' },
  { field: 'cover_alt_en', label: '封面替代文字（English）' },
  { field: 'tags', label: '標籤' },
  { field: 'reading_minutes', label: '閱讀時間' },
];

/** A snapshot value as one comparable string; arrays join, null and undefined read as empty. */
export function snapshotText(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(item => String(item)).join(', ');
  return String(value);
}

/** Only the fields that actually differ, each with its line diff. */
export function diffSnapshots(before: Record<string, unknown>, after: Record<string, unknown>): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  for (const { field, label } of revisionFields) {
    const left = snapshotText(before[field]);
    const right = snapshotText(after[field]);
    if (left === right) continue;
    const rows = diffLines(left, right);
    diffs.push({
      field,
      label,
      before: left,
      after: right,
      rows,
      added: rows.filter(row => row.type === 'added').length,
      removed: rows.filter(row => row.type === 'removed').length,
    });
  }
  return diffs;
}
