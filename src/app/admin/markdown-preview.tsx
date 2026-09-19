'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { Markdown } from '@/components/markdown';

/**
 * Live preview rendered by the very same <Markdown> the public pages use, so the editor sees exactly
 * what ships. The admin has no NextIntlClientProvider of its own (it lives outside /[locale]), and
 * <Markdown> renders next-intl <Link> for internal hrefs, so the preview supplies a zh context.
 *
 * The preview is not a live region on purpose: re-announcing the whole body on every keystroke would
 * make the editor unusable with a screen reader. It is a labelled region the user can visit instead.
 */
export function MarkdownPreview({ value, label }: { value: string; label: string }) {
  const [deferred, setDeferred] = useState(value);
  const [open, setOpen] = useState(true);
  const headingId = useId();

  // Parsing a 60k-character body on every keystroke drops frames; 200ms after typing stops is enough.
  useEffect(() => {
    const timer = setTimeout(() => setDeferred(value), 200);
    return () => clearTimeout(timer);
  }, [value]);

  return <section className="admin-preview" aria-labelledby={headingId}>
    <div className="admin-preview-head">
      <h3 id={headingId} className="text-xs font-normal">預覽：{label}</h3>
      <button className="admin-preview-toggle" type="button" onClick={() => setOpen(current => !current)} aria-expanded={open}>
        {open ? '收合預覽' : '展開預覽'}
      </button>
    </div>
    {open ? <div className="admin-preview-body">
      {deferred.trim()
        ? <NextIntlClientProvider locale="zh"><Markdown>{deferred}</Markdown></NextIntlClientProvider>
        : <p className="admin-preview-empty">開始輸入後，這裡會即時顯示公開頁面的排版結果。</p>}
    </div> : null}
  </section>;
}

/** Textarea on the left, live preview on the right (stacked below 1100px). */
export function MarkdownField({ children, value, label }: { children: ReactNode; value: string; label: string }) {
  return <div className="admin-editor-pane">
    <div className="admin-editor-input">{children}</div>
    <MarkdownPreview value={value} label={label} />
  </div>;
}
