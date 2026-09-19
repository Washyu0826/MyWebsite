'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Menu, X } from 'lucide-react';
import { Navigation } from './navigation';
import { Button } from './ui/button';

const closeThreshold = 96;

/**
 * Full-screen navigation for phones.
 *
 * Swipe down to dismiss, but only from the top of the scroll container, so scrolling a long menu is
 * never mistaken for a dismissal. Escape and the close button do the same thing, so the gesture is an
 * addition and never the only way out (WCAG 2.2 2.5.7). The panel is padded with env(safe-area-inset-*)
 * so nothing sits under the notch or the home indicator.
 */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [sliding, setSliding] = useState(false);
  const dragging = useRef<{ id: number; y: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const t = useTranslations('Site');

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' || (scroller.current?.scrollTop || 0) > 0) return;
    dragging.current = { id: event.pointerId, y: event.clientY };
    setSliding(true);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (dragging.current?.id !== event.pointerId) return;
    setOffset(Math.max(0, event.clientY - dragging.current.y));
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (dragging.current?.id !== event.pointerId) return;
    const travelled = event.clientY - dragging.current.y;
    dragging.current = null;
    setSliding(false);
    setOffset(0);
    if (travelled > closeThreshold) setOpen(false);
  }

  return <Dialog.Root open={open} onOpenChange={value => { setOpen(value); setOffset(0); setSliding(false); dragging.current = null; }}>
    <Dialog.Trigger asChild><Button variant="ghost" aria-label={t('openMenu')} className="md:hidden"><Menu size={20} /></Button></Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-paper" />
      <Dialog.Content aria-describedby={undefined}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        style={{ transform: offset ? `translateY(${offset}px)` : undefined, transition: sliding ? 'none' : 'transform 0.2s ease-out' }}
        className="fixed inset-0 z-50 flex flex-col bg-paper px-[max(1.25rem,env(safe-area-inset-left))] pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <span aria-hidden="true" className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-rule md:hidden" />
        <div className="flex items-center justify-between border-b border-rule pb-5">
          <Dialog.Title className="text-h3">{t('navigation')}</Dialog.Title>
          <Dialog.Close asChild><Button variant="ghost" aria-label={t('closeMenu')}><X size={20} /></Button></Dialog.Close>
        </div>
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <nav className="mt-8 flex flex-col items-start gap-4 [&_a]:text-h2" aria-label={t('navigation')}>
            <Navigation onNavigate={() => setOpen(false)} />
          </nav>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
