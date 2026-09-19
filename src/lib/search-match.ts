// Ranking for the command palette. Exact match beats prefix beats word-start beats
// substring beats subsequence; 0 means "no match". Iteration is by code point so CJK
// queries behave the same as Latin ones.
const boundary = /[\s\-_/·,，、：:.]/;

export function matchScore(query: string, text: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const t = text.toLowerCase();
  if (!t) return 0;
  if (t === q) return 1000;

  const index = t.indexOf(q);
  if (index === 0) return 900 - Math.min(t.length, 100);
  if (index > 0) {
    const base = boundary.test(t[index - 1]) ? 700 : 500;
    return base - Math.min(index, 60) - Math.min(t.length, 100) / 10;
  }

  // Subsequence: every character of the query appears in order, ideally close together.
  let cursor = 0, gaps = 0, first = -1;
  for (const char of q) {
    const found = t.indexOf(char, cursor);
    if (found === -1) return 0;
    if (first === -1) first = found;
    gaps += found - cursor;
    cursor = found + 1;
  }
  return Math.max(1, 300 - gaps * 5 - Math.min(first, 40));
}

/** Best score across an item's searchable fields. */
export function bestScore(query: string, fields: readonly (string | null | undefined)[]): number {
  let best = 0;
  for (const field of fields) {
    if (!field) continue;
    const score = matchScore(query, field);
    if (score > best) best = score;
  }
  return best;
}

/** Filters out non-matching items and sorts the rest by score, keeping input order for ties. */
export function rankItems<T>(query: string, items: readonly T[], fieldsOf: (item: T) => readonly (string | null | undefined)[]): T[] {
  return items
    .map((item, order) => ({ item, order, score: bestScore(query, fieldsOf(item)) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(entry => entry.item);
}
