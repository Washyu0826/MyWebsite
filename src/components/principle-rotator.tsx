'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

export type Principle = { code: string; title: string; body: string };
type Labels = { group: string; pause: string; play: string; show: string };

/** Matches the hero typewriter: a fixed floor plus a per-character cost. */
function typeDuration(text: string) {
  return Math.max(260, text.length * 34);
}
const BODY_DELAY = 220;
const BODY_FADE = 620;
const DWELL = 2600;

/**
 * The three principles, one at a time: the title types itself, the body fades in under it, then the
 * next one takes over. Three stacked blocks used to push the last one below the fold; rotating them
 * keeps the hero to one screen.
 *
 * What it will not do: rotate before JavaScript has decided it may. The server renders all three
 * expanded, which is what a crawler, a failed bundle and `prefers-reduced-motion` all keep. Motion
 * only starts once the block is on screen and the tab is in front, and it stops on hover, on focus,
 * and whenever the reader presses pause — content that moves on its own needs a way to stop it.
 */
export function PrincipleRotator({ items, labels }: { items: Principle[]; labels: Labels }) {
  const [rotating, setRotating] = useState(false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [visible, setVisible] = useState(true);
  const scope = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scope.current;
    if (!element) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setRotating(!preference.matches);
    sync();
    preference.addEventListener('change', sync);

    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);

    let observer: IntersectionObserver | undefined;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => setOnScreen(entries.some(entry => entry.isIntersecting)));
      observer.observe(element);
    }
    return () => {
      preference.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
    };
  }, []);

  const current = items[index];
  const running = rotating && !paused && !held && onScreen && visible && items.length > 1;

  useEffect(() => {
    if (!running || !current) return;
    const timer = window.setTimeout(
      () => setIndex(value => (value + 1) % items.length),
      typeDuration(current.title) + BODY_DELAY + BODY_FADE + DWELL,
    );
    return () => window.clearTimeout(timer);
  }, [running, current, index, items.length]);

  // Choosing a panel by hand means taking over; the play button hands control back.
  const select = useCallback((next: number) => {
    setIndex(next);
    setPaused(true);
  }, []);

  return <div
    ref={scope}
    className="principle-rotator"
    data-rotating={rotating ? 'true' : 'false'}
    onMouseEnter={() => setHeld(true)}
    onMouseLeave={() => setHeld(false)}
    onFocusCapture={() => setHeld(true)}
    onBlurCapture={() => setHeld(false)}
  >
    <div className="signature-principles" aria-label={labels.group}>
      {items.map((item, position) => {
        const active = !rotating || position === index;
        return <div
          key={item.code}
          className="signature-principle"
          data-active={active ? 'true' : 'false'}
          // Only the panel on show is reachable; the others are out of the tab order and unread.
          inert={rotating && !active}
          style={{
            '--type-duration': `${typeDuration(item.title)}ms`,
            '--type-steps': item.title.length,
            '--body-delay': `${typeDuration(item.title) + BODY_DELAY}ms`,
            '--body-fade': `${BODY_FADE}ms`,
          } as React.CSSProperties}
        >
          <span>{item.code}</span>
          <strong><span className="sr-only">{item.title}</span><span className="typewriter-text" aria-hidden="true">{item.title}</span></strong>
          <p>{item.body}</p>
        </div>;
      })}
    </div>

    {rotating && items.length > 1 && <div className="principle-controls">
      <div className="principle-steps">
        {items.map((item, position) => <button
          key={item.code}
          type="button"
          aria-pressed={position === index}
          aria-label={labels.show.replace('{index}', item.code)}
          onClick={() => select(position)}
        >{item.code}</button>)}
      </div>
      <button
        type="button"
        className="principle-toggle"
        aria-label={paused ? labels.play : labels.pause}
        onClick={() => setPaused(value => !value)}
      >{paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}</button>
    </div>}
  </div>;
}
