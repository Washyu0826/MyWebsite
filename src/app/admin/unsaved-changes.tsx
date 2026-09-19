'use client';

import { useEffect, useRef } from 'react';

const warning = '這個表單有尚未儲存的變更，離開後會遺失。確定要離開嗎？';

/**
 * Warns before a dirty form is abandoned.
 *
 * `beforeunload` covers reloads, closing the tab and external links. The App Router has no
 * route-change event to hook into, so in-app navigation is caught by a capture-phase click listener
 * on internal <a> elements — this runs before next/link's own handler, so cancelling it really does
 * stop the navigation. Keyboard activation of a link fires a click too, so it is covered as well.
 */
export function useUnsavedChanges(dirty: boolean) {
  const active = useRef(dirty);
  useEffect(() => { active.current = dirty; }, [dirty]);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!active.current) return;
      event.preventDefault();
      event.returnValue = '';
    }

    function onClick(event: MouseEvent) {
      if (!active.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const href = anchor.getAttribute('href') || '';
      if (href.startsWith('#')) return;
      // Absolute URLs to another origin, mailto:, tel: ... leave the app anyway; beforeunload handles those.
      if (/^[a-z]+:/i.test(href) && !href.startsWith(window.location.origin)) return;
      if (!window.confirm(warning)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, []);
}

/** Visible badge plus the polite announcement that goes with it. */
export function DirtyBadge({ dirty }: { dirty: boolean }) {
  return <>
    {dirty ? <span className="admin-dirty-flag">尚未儲存</span> : null}
    <span className="admin-visually-hidden" role="status" aria-live="polite">
      {dirty ? '表單有尚未儲存的變更。' : ''}
    </span>
  </>;
}
