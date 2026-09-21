'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type Principle = { code: string; title: string; body: string };
type Labels = { group: string; show: string };

/** One full turn: the number flips in, the title slides up, the body follows, then it holds. */
const CYCLE = 4500;
/** r=46 in a 100-unit box; the ring is drawn as one dash the length of its own circumference. */
const RING = 2 * Math.PI * 46;

/**
 * The three principles, one at a time. The oversized number carries the eye and its ring doubles as
 * the clock: when the ring closes, the next one takes over.
 *
 * There is no play button on purpose. The ring freezes whenever the reader hovers the block, tabs
 * into it, or picks a number, which is the stop that auto-advancing content owes them; picking a
 * number also parks it there. Nothing rotates at all under `prefers-reduced-motion`, off-screen, or
 * on a background tab, and the server renders all three expanded, so a crawler or a failed bundle
 * still sees every word.
 */
export function PrincipleRotator({ items, labels }: { items: Principle[]; labels: Labels }) {
  const [rotating, setRotating] = useState(false);
  const [index, setIndex] = useState(0);
  const [parked, setParked] = useState(false);
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

  const running = rotating && !parked && !held && onScreen && visible && items.length > 1;

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => setIndex(value => (value + 1) % items.length), CYCLE);
    return () => window.clearTimeout(timer);
  }, [running, index, items.length]);

  // Picking a number is taking over: it stops there until the reader picks another one.
  const select = useCallback((next: number) => {
    setIndex(next);
    setParked(true);
  }, []);

  const current = items[index];

  return <div
    ref={scope}
    className="principle-rotator"
    data-rotating={rotating ? 'true' : 'false'}
    data-running={running ? 'true' : 'false'}
    style={{ '--cycle': `${CYCLE}ms`, '--ring': RING.toFixed(2) } as React.CSSProperties}
    onMouseEnter={() => setHeld(true)}
    onMouseLeave={() => setHeld(false)}
    onFocusCapture={() => setHeld(true)}
    onBlurCapture={() => setHeld(false)}
  >
    {rotating && current && <div className="principle-marker" aria-hidden="true">
      {/* Keyed on the index so the flip and the ring start again on every turn. */}
      <div className="principle-number" key={`${index}-${parked}`}>
        <svg className="principle-ring" viewBox="0 0 100 100">
          <circle className="principle-ring-track" cx="50" cy="50" r="46" />
          <circle className="principle-ring-progress" cx="50" cy="50" r="46" />
        </svg>
        <span>{current.code}</span>
      </div>
    </div>}

    <div className="signature-principles" aria-label={labels.group}>
      {items.map((item, position) => {
        const active = !rotating || position === index;
        return <div
          key={item.code}
          className="signature-principle"
          data-active={active ? 'true' : 'false'}
          inert={rotating && !active}
        >
          <span>{item.code}</span>
          <strong>{item.title}</strong>
          <p>{item.body}</p>
        </div>;
      })}
    </div>

    {rotating && items.length > 1 && <div className="principle-steps">
      {items.map((item, position) => <button
        key={item.code}
        type="button"
        aria-pressed={position === index}
        aria-label={labels.show.replace('{index}', item.code)}
        onClick={() => select(position)}
      >{item.code}</button>)}
    </div>}
  </div>;
}
