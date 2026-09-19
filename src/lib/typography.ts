// Pure text helpers for the places CSS cannot reach: Satori-rendered OG cards, <title>/description
// metadata, canvas labels. In the DOM, :lang(zh) in styles/typography.css already does this with
// text-autospace / text-spacing-trim, so calling pangu() on rendered copy would double the gap.
// Never run these over user-authored Markdown bodies — the author's spacing is the author's.

// Han-ish: ideographs, kana, bopomofo, Hangul. Fullwidth punctuation is deliberately excluded —
// it carries its own blank, so a space beside 。 or 」 would open a hole rather than close one.
const HAN = '\\u2E80-\\u2FFF\\u3005\\u3007\\u3040-\\u30FF\\u3105-\\u312F\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF\\uAC00-\\uD7AF';
const WIDE = `${HAN}\\u3000-\\u303F\\uFF01-\\uFF60\\uFFE0-\\uFFE6`;
const HAN_THEN_LATIN = new RegExp(`([${HAN}])([A-Za-z0-9@#$%&([<])`, 'g');
const LATIN_THEN_HAN = new RegExp(`([A-Za-z0-9%)\\]>])([${HAN}])`, 'g');
const HAN_RE = new RegExp(`[${HAN}]`);
const WIDE_RE = new RegExp(`[${WIDE}]`);

export function hasHan(text: string) { return HAN_RE.test(text); }

/** Insert the classic "pangu" space between Han and adjacent Latin/numerals. Idempotent. */
export function pangu(text: string) {
  return text.replace(HAN_THEN_LATIN, '$1 $2').replace(LATIN_THEN_HAN, '$1 $2');
}

/** Column width where a fullwidth glyph counts as two, for fixed-width layouts such as OG cards. */
export function visualWidth(text: string) {
  let width = 0;
  for (const char of text) width += WIDE_RE.test(char) ? 2 : 1;
  return width;
}

/** Truncate to a column budget, counting fullwidth glyphs as two and reserving room for the mark. */
export function truncateVisual(text: string, maxWidth: number, ellipsis = '…') {
  if (maxWidth <= 0) return '';
  if (visualWidth(text) <= maxWidth) return text;
  const budget = maxWidth - visualWidth(ellipsis);
  if (budget <= 0) return ellipsis;
  let width = 0;
  let out = '';
  for (const char of text) {
    const next = width + (WIDE_RE.test(char) ? 2 : 1);
    if (next > budget) break;
    out += char;
    width = next;
  }
  return out.trimEnd() + ellipsis;
}
