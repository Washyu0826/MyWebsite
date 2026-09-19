'use client';
import * as Dialog from '@radix-ui/react-dialog';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useRef, useState } from 'react';
import { Button } from './ui/button';

export type LightboxImage = { src: string; alt: string; width?: number; height?: number; blurDataURL?: string };

const minScale = 1;
const maxScale = 4;
const swipeThreshold = 56;

type LabelKey = 'previousImage' | 'nextImage' | 'zoomIn' | 'zoomOut' | 'resetZoom' | 'hint';

function useLabels() {
  const t = useTranslations('Projects');
  return { t, text: (key: LabelKey) => t(key) };
}

/**
 * Click / tap / Enter opens a full-screen viewer.
 *
 * Touch: pinch to zoom, drag to pan while zoomed, swipe left/right between the images of `images`.
 * Everything a gesture does is also on a 44px button and on a key (arrows, +, -, 0, Escape), so the
 * viewer stays usable with a mouse, a keyboard and a screen reader (WCAG 2.2 2.5.7 needs the
 * non-dragging path; 2.1.1 needs the keyboard one). Browser zoom is untouched: the pinch handler only
 * listens on the image stage inside the dialog, never on the document.
 */
export function ImageLightbox({ src, alt, width = 1200, height = 675, priority = false, blurDataURL, images }: {
  src: string; alt: string; width?: number; height?: number; priority?: boolean;
  /** Tiny data URL from the upload pipeline; omitted for images stored before it existed. */
  blurDataURL?: string;
  /** Optional gallery this image belongs to; enables swipe / arrow-key navigation. */
  images?: LightboxImage[];
}) {
  const { t, text } = useLabels();
  const gallery = images?.length ? images : [{ src, alt, width, height, blurDataURL }];
  const startIndex = Math.max(0, gallery.findIndex(item => item.src === src));

  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(startIndex);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [interacting, setInteracting] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ distance: 0, scale: 1, x: 0, y: 0, panX: 0, panY: 0 });

  const current = gallery[Math.min(index, gallery.length - 1)] || gallery[0];
  const many = gallery.length > 1;

  const reset = useCallback(() => { setScale(1); setPan({ x: 0, y: 0 }); }, []);

  const go = useCallback((step: number) => {
    if (!many) return;
    setIndex(value => (value + step + gallery.length) % gallery.length);
    reset();
  }, [gallery.length, many, reset]);

  const zoom = useCallback((factor: number) => {
    setScale(value => {
      const next = Math.min(maxScale, Math.max(minScale, value * factor));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowRight') { event.preventDefault(); go(1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); }
    else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.4); }
    else if (event.key === '-') { event.preventDefault(); zoom(1 / 1.4); }
    else if (event.key === '0') { event.preventDefault(); reset(); }
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // Register first: setPointerCapture can throw (a pointer that is already gone) and we still want
    // the gesture bookkeeping, otherwise the matching pointerup would be ignored.
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* capture is an optimisation */ }
    setInteracting(true);
    const points = [...pointers.current.values()];
    gesture.current = {
      distance: points.length === 2 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0,
      scale, x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y,
    };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];
    if (points.length >= 2) {
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      if (!gesture.current.distance) { gesture.current.distance = distance; gesture.current.scale = scale; return; }
      setScale(Math.min(maxScale, Math.max(minScale, gesture.current.scale * (distance / gesture.current.distance))));
      return;
    }
    if (scale > 1) {
      setPan({
        x: gesture.current.panX + (event.clientX - gesture.current.x),
        y: gesture.current.panY + (event.clientY - gesture.current.y),
      });
    }
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const start = gesture.current;
    const single = pointers.current.size === 1;
    pointers.current.delete(event.pointerId);
    if (!pointers.current.size) { gesture.current = { ...gesture.current, distance: 0 }; setInteracting(false); }
    if (!single || scale > 1) return;
    const dx = event.clientX - start.x;
    if (Math.abs(dx) > swipeThreshold && Math.abs(dx) > Math.abs(event.clientY - start.y)) go(dx < 0 ? 1 : -1);
  }

  const zoomed = scale > 1;

  return <Dialog.Root open={open} onOpenChange={value => {
    setOpen(value);
    // Each opening starts from the image that was clicked, unzoomed.
    if (value) { setIndex(startIndex); setScale(1); setPan({ x: 0, y: 0 }); }
    pointers.current.clear();
    setInteracting(false);
  }}>
    <Dialog.Trigger asChild><button className="block w-full overflow-hidden rounded-lg border border-rule" aria-label={t('enlarge', { alt })}>
      <Image src={src} alt={alt} width={width} height={height} priority={priority}
        {...(blurDataURL ? { placeholder: 'blur' as const, blurDataURL } : {})}
        sizes="(max-width: 767px) calc(100vw - 40px), 900px" className="h-auto w-full bg-ash" />
    </button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-paper/95" />
      <Dialog.Content onKeyDown={onKeyDown} aria-describedby={undefined}
        className="fixed inset-0 z-50 flex flex-col gap-3 bg-paper p-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] md:gap-4 md:p-6">
        <div className="flex items-center justify-between gap-4">
          <Dialog.Title className="text-meta min-w-0 truncate">{current.alt}</Dialog.Title>
          <Dialog.Close asChild><Button variant="outline" aria-label={t('closeImage')}><X size={20} /></Button></Dialog.Close>
        </div>

        <div className="relative min-h-0 flex-1 touch-none overflow-hidden select-none"
          onPointerDown={onPointerDown} onPointerMove={onPointerMove}
          onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
          onDoubleClick={() => (zoomed ? reset() : zoom(2.5))}>
          <div className="absolute inset-0" style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
            transition: interacting ? 'none' : 'transform 0.18s ease-out',
            cursor: zoomed ? 'grab' : 'zoom-in',
          }}>
            <Image key={current.src} src={current.src} alt={current.alt} fill sizes="100vw"
              {...(current.blurDataURL ? { placeholder: 'blur' as const, blurDataURL: current.blurDataURL } : {})}
              className="object-contain" />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {many ? <>
              <Button variant="outline" aria-label={text('previousImage')} onClick={() => go(-1)}><ChevronLeft size={20} /></Button>
              <Button variant="outline" aria-label={text('nextImage')} onClick={() => go(1)}><ChevronRight size={20} /></Button>
              <span className="text-meta text-graphite tabular-nums" aria-hidden="true">{index + 1} / {gallery.length}</span>
            </> : null}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" aria-label={text('zoomOut')} disabled={scale <= minScale} onClick={() => zoom(1 / 1.4)}><Minus size={20} /></Button>
            <Button variant="outline" aria-label={text('zoomIn')} disabled={scale >= maxScale} onClick={() => zoom(1.4)}><Plus size={20} /></Button>
            <Button variant="outline" aria-label={text('resetZoom')} disabled={!zoomed && !pan.x && !pan.y} onClick={reset}><RotateCcw size={20} /></Button>
          </div>
        </div>
        <p className="text-meta text-graphite hidden md:block">{text('hint')}</p>
        <p className="sr-only" role="status" aria-live="polite">
          {many ? `${index + 1} / ${gallery.length} · ${current.alt}` : ''}
        </p>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
