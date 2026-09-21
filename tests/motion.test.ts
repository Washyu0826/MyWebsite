import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const depth = source('styles/depth.css');
const backdrop = source('components/cubist-backdrop.tsx');
const reveal = source('components/section-reveal.tsx');
/** Comments stripped, for the rules that are about code rather than about prose. */
const bare = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('the depth effect is behind both of its gates', () => {
  // Reduced motion is the accessibility gate. It is also what pins the screenshot tests, which emulate
  // the preference, so losing it would make every baseline depend on scroll position.
  assert.match(depth, /@media \(prefers-reduced-motion: no-preference\)/);
  // And the compatibility gate: Firefox has no scroll-driven animations, and without this it would
  // apply the animation properties, get no timeline, and show the keyframe start state for ever.
  assert.match(depth, /@supports \(animation-timeline: view\(\)\)/);
  const gated = depth.slice(depth.indexOf('@media (prefers-reduced-motion: no-preference)'));
  assert.ok(gated.indexOf('@supports') < gated.indexOf('animation-timeline: view()'), 'the @supports must wrap the rule');
  for (const selector of ['.experience-row', '.project-row', '.article-row']) {
    assert.ok(gated.includes(selector), `${selector} is not inside the gates`);
  }
});

test('the scroll-linked animation only ever moves properties the compositor owns', () => {
  const frames = /@keyframes row-stand-up\s*\{([\s\S]*?)\n\}/.exec(depth);
  assert.ok(frames, 'the keyframes are still called row-stand-up');
  const declared = [...frames[1].matchAll(/^\s{4}([a-z-]+):/gm)].map(match => match[1]);
  // transform and opacity are the only two a browser can animate off the main thread. Anything else
  // here - width, top, clip-path, filter - would put per-frame work back on the thread this whole
  // approach exists to keep free, on a page that already spends it on a canvas.
  assert.deepEqual([...new Set(declared)].sort(), ['opacity', 'transform']);
  assert.doesNotMatch(frames[1], /clip-path|width|height|top|left|margin|filter|box-shadow/);
});

test('a row that is not animating yet carries its ordinary styling', () => {
  // `both` would leave every row below the fold at the keyframe start - text at 0.35 opacity - and a
  // contrast checker reads that as failing, because for anyone whose page has stopped there it is.
  // Measured: with `both`, Lighthouse accessibility on the homepage fell from 100 to 97 with six
  // colour-contrast violations; with `forwards` it is 100 again.
  assert.match(depth, /animation: row-stand-up linear forwards;/);
  assert.doesNotMatch(depth, /animation: row-stand-up linear both;/);
  // Entry only. Past the range the row holds the upright pose, including on the way off the top.
  assert.match(depth, /animation-range: entry 0% entry 100%;/);
  assert.doesNotMatch(depth, /animation-range:[^;]*exit/);
});

test('the start pose is a tip back and away, at half amplitude on a phone', () => {
  const value = (name: string, text = depth) => {
    const found = new RegExp(`--${name}: (-?[\\d.]+)(deg|px)?`).exec(text);
    return found ? Number(found[1]) : NaN;
  };
  assert.ok(value('depth-tip') > 0 && value('depth-tip') <= 16, 'the tip is a lean, not a somersault');
  assert.ok(value('depth-back') < 0, 'the row starts further away, not nearer');
  // perspective/(perspective - z) is the size it starts at, and the brief was about 0.85.
  const lens = value('depth-lens'), scale = lens / (lens - value('depth-back'));
  assert.ok(scale > 0.8 && scale < 0.9, `a row starts at ${scale.toFixed(3)} of its size`);
  assert.ok(value('depth-dim') >= 0.3, 'a row skimmed past at speed is faint, never absent');
  const phone = depth.slice(depth.indexOf('@media (max-width: 767px)'));
  assert.ok(Math.abs(value('depth-tip', phone)) <= value('depth-tip') / 2 + 0.01, 'the phone takes half the angle');
  assert.ok(Math.abs(value('depth-back', phone)) <= Math.abs(value('depth-back')) / 2 + 1, 'and half the distance');
});

test('the bounce is only taken away where it is not also a gesture', () => {
  const rule = /@media \(hover: hover\) and \(pointer: fine\)\s*\{\s*html\s*\{\s*overscroll-behavior-y: none;/;
  assert.match(depth, rule);
  // Unconditionally disabling it would take pull-to-refresh with it on every touch device.
  assert.doesNotMatch(bare(depth).replace(rule, ''), /overscroll-behavior/);
});

test('the backdrop does its scroll work once per frame, not once per event', () => {
  const code = bare(backdrop);
  // A wheel fires scroll events faster than the screen refreshes. Writing the parallax straight from
  // the handler meant a style invalidation per event and the judder that goes with doing layout-
  // adjacent work inside a scroll handler.
  const onScroll = /const onScroll = \(\) => \{([\s\S]*?)\n    \};/.exec(code);
  assert.ok(onScroll, 'onScroll is still a block');
  assert.match(onScroll[1], /requestAnimationFrame/);
  assert.doesNotMatch(onScroll[1], /canvas\.style/, 'the handler must not write style directly');
  assert.match(code, /if \(drifting\) cancelAnimationFrame\(drifting\)/, 'and the pending frame is cancelled on teardown');
  // Writing a value the element already has still invalidates style, so drift() compares first.
  assert.match(code, /Math\.abs\(d\.shift - placed\.shift\)[\s\S]{0,120}return;/);
});

test('the picture gives the scroll most of the frames while the page is moving', () => {
  const code = bare(backdrop);
  const every = /const SCROLL_EVERY = (\d+), SCROLL_QUIET = (\d+);/.exec(code);
  assert.ok(every, 'the two scroll constants are still declared together');
  assert.ok(Number(every[1]) >= 2 && Number(every[1]) <= 4, 'it thins the frames, it does not freeze');
  assert.ok(Number(every[2]) >= 100 && Number(every[2]) <= 400, 'full rate comes back promptly after the last scroll');
  assert.match(code, /performance\.now\(\) - moved < SCROLL_QUIET \? SCROLL_EVERY/);
});

test('the section observer writes an attribute only when the value changes', () => {
  const code = bare(reveal);
  // Nine thresholds on three sections: the callback runs constantly on the way down the page, and an
  // attribute write is a style invalidation for the section and everything under it even when the
  // value is unchanged. Measured on the homepage: 541 style recalculations became 3.
  assert.match(code, /if \(active !== lit\) \{ lit = active; element\.dataset\.active =/);
  assert.match(code, /const show = \(\) => \{ if \(shown\) return; shown = true; element\.dataset\.enter = 'in'; \};/);
});
