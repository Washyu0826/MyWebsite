'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';

export const previewSize = { width: 240, height: 135 };
const edge = 12, gap = 20;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

/** Offsets the card from the cursor, flipping to the left when it would run past the right edge. */
export function previewPosition(x: number, y: number, viewport: { width: number; height: number },
  size: { width: number; height: number } = previewSize) {
  const left = x + gap + size.width > viewport.width - edge ? x - gap - size.width : x + gap;
  return {
    left: clamp(left, edge, viewport.width - size.width - edge),
    top: clamp(y - size.height / 2, edge, viewport.height - size.height - edge),
  };
}

type Cover = { src: string; alt: string };
function readCover(target: EventTarget | null): Cover | null {
  const row = target instanceof Element ? target.closest<HTMLElement>('[data-cover-src]') : null;
  return row?.dataset.coverSrc ? { src: row.dataset.coverSrc, alt: row.dataset.coverAlt || '' } : null;
}

/** Wraps a list of rows; any row carrying data-cover-src previews its cover next to the cursor. */
export function CoverPreview({ className, children }: { className?: string; children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const [cover, setCover] = useState<Cover | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // A cursor-following preview means nothing on touch, and reduced motion asks for no movement at all.
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setEnabled(true);
  }, []);

  useEffect(() => {
    const list = root.current;
    if (!enabled || !list) return;
    const hide = () => setCover(null);
    function move(event: PointerEvent) {
      if (event.pointerType !== 'mouse') { hide(); return; }
      const next = readCover(event.target);
      setCover(current => (current?.src === next?.src ? current : next));
      if (!next || !card.current) return;
      const { left, top } = previewPosition(event.clientX, event.clientY, { width: window.innerWidth, height: window.innerHeight });
      card.current.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    }
    list.addEventListener('pointermove', move);
    list.addEventListener('pointerleave', hide);
    window.addEventListener('scroll', hide, { passive: true });
    window.addEventListener('blur', hide);
    return () => {
      list.removeEventListener('pointermove', move);
      list.removeEventListener('pointerleave', hide);
      window.removeEventListener('scroll', hide);
      window.removeEventListener('blur', hide);
    };
  }, [enabled]);

  return <div ref={root} className={className}>
    {children}
    {enabled && createPortal(
      <div ref={card} className="cover-preview" data-visible={cover ? '1' : undefined} aria-hidden="true">
        {cover ? <Image src={cover.src} alt={cover.alt} width={480} height={270} sizes="240px" /> : null}
      </div>, document.body)}
  </div>;
}
