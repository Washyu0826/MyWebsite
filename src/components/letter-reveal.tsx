'use client';
import { Fragment, useEffect, useRef } from 'react';
const DURATION = 620, STEP = 26;
// Screen readers get the plain string; the per-letter spans are decoration. CSS in hero.css only animates
// when the inline script marked JS as available, so no-JS and reduced-motion render finished text.
export function LetterReveal({ text }: { text: string }) {
  const scope = useRef<HTMLSpanElement>(null);
  let offset = 0;
  const words = text.split(' ').map(word => { const start = offset; offset += word.length + 1; return { word, start }; });
  useEffect(() => {
    const element = scope.current;
    if (!element) return;
    // Flipping data-js stops the hero from replaying on client-side navigation later in the session.
    const done = () => { element.dataset.letters = 'done'; document.documentElement.dataset.js = 'seen'; };
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let seen = false;
    try { seen = Boolean(sessionStorage.getItem('hsien-intro')); } catch { /* Storage may be disabled. */ }
    if (seen || preference.matches) { element.dataset.letters = 'done'; return; }
    const finish = () => { if (preference.matches) done(); };
    preference.addEventListener('change', finish);
    const timer = window.setTimeout(done, DURATION + text.length * STEP + 120);
    return () => { window.clearTimeout(timer); preference.removeEventListener('change', finish); };
  }, [text]);
  return <>
    <span className="sr-only">{text}</span>
    <span ref={scope} className="letter-reveal" data-letters="" aria-hidden="true">
      {words.map(({ word, start }, index) => <Fragment key={`${index}-${word}`}>
        {index ? ' ' : null}
        <span className="letter-word">
          {[...word].map((char, position) => <span key={position} className="letter" style={{ '--letter-index': start + position } as React.CSSProperties}>
            <span>{char}</span>
          </span>)}
        </span>
      </Fragment>)}
    </span>
  </>;
}
