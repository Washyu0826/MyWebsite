import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  AMBIENT_KEY, BELL, BREATH, CUES, CUE_GAIN, DRIFT, FADE_IN, FADE_OUT, GAP_FAST, GAP_SLOW, PEAK_GAIN, ROOT, SCALE,
  breath, centreAt, decayAt, gapAt, hzOf, levelAt, pickStep, pluck, readPreference, savePreference, toneAt,
} from '../src/lib/audio/ambient';
import { mulberry32 } from '../src/components/cubist-backdrop';

const source = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const samples = (n: number, step: number, f: (t: number) => number) => Array.from({ length: n }, (_, i) => f(i * step));
const RATE = 48000;

/** RMS of one window, and the amplitude of one harmonic over it (Goertzel), so a rendered note can be
 *  measured the way the browser analyser measures it. */
function rms(signal: Float32Array, from: number, len: number) {
  let square = 0;
  for (let i = from; i < from + len && i < signal.length; i++) square += signal[i] * signal[i];
  return Math.sqrt(square / len);
}
function harmonic(signal: Float32Array, from: number, len: number, hz: number) {
  const w = (2 * Math.PI * hz) / RATE, c = 2 * Math.cos(w);
  let s1 = 0, s2 = 0;
  for (let i = from; i < from + len && i < signal.length; i++) { const s = signal[i] + c * s1 - s2; s2 = s1; s1 = s; }
  return Math.hypot(s1 - s2 * Math.cos(w), s2 * Math.sin(w)) / len;
}
function note(hz: number, tone = 0.5, seed = 3) {
  const decay = decayAt(hz), out = new Float32Array(Math.round(RATE * decay));
  return { signal: pluck(out, hz, RATE, tone, decay, mulberry32(seed)), decay };
}

test('only an explicit opt-in counts as on', () => {
  assert.equal(readPreference('on'), true);
  for (const raw of [null, undefined, '', 'off', 'ON', 'true', '1', 'yes', ' on']) assert.equal(readPreference(raw), false, String(raw));
});

test('the preference survives a browser with no storage at all', () => {
  // Node has no localStorage, which is the same ReferenceError a locked-down private window throws.
  assert.doesNotThrow(() => savePreference(true));
  assert.doesNotThrow(() => savePreference(false));
});

test('the toggle and the cue helper agree with the graph on the storage key', () => {
  // Both repeat the key rather than importing it, so that reading the preference does not pull the
  // audio graph into the first-load bundle. This is what keeps the three copies honest.
  assert.match(source('components/ambient-audio.tsx'), new RegExp(`localStorage\\.getItem\\('${AMBIENT_KEY}'\\) === 'on'`));
  assert.match(source('lib/audio/cue.ts'), new RegExp(`localStorage\\.getItem\\('${AMBIENT_KEY}'\\) !== 'on'`));
  // And the helper must reach the graph by dynamic import only, or every page that copies an address
  // downloads the synthesis whether or not the visitor ever asked for sound.
  assert.match(source('lib/audio/cue.ts'), /void import\('\.\/ambient'\)/);
  assert.doesNotMatch(source('lib/audio/cue.ts'), /^import \{[^}]*\} from '\.\/ambient'/m);
});

test('the confirmation sounds are wired to exactly two events', () => {
  assert.deepEqual(Object.keys(CUES).sort(), ['copy', 'sent']);
  assert.match(source('components/copy-email.tsx'), /cue\('copy'\)/);
  assert.match(source('app/[locale]/contact/contact-form.tsx'), /state\.status === 'ok'.*cue\('sent'\)/);
  // Nothing else anywhere in the app may ask for a sound.
  const callers = ['components/copy-email.tsx', 'app/[locale]/contact/contact-form.tsx'];
  for (const file of ['components/nav.tsx', 'components/footer.tsx', 'components/command-palette.tsx']) {
    try { assert.doesNotMatch(source(file), /audio\/cue/, file); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  assert.equal(callers.length, Object.keys(CUES).length);
});

test('the sound breathes on the backdrop\'s own sweep period', () => {
  // cubist-backdrop.tsx cannot be imported for its phase (the canvas owns its start time) and cannot
  // be edited, so the two share a clock and this constant. If the painting's sweep is retimed, retime this.
  const sweep = /const SWEEP = (\d+)/.exec(source('components/cubist-backdrop.tsx'));
  assert.ok(sweep, 'the backdrop still declares SWEEP');
  assert.equal(Number(sweep[1]), BREATH);
  assert.ok(DRIFT >= 20 && DRIFT <= 40, 'the second cycle sits inside the facets\' 20-40s drift band');
  assert.notEqual(BREATH, DRIFT); // equal periods would collapse into one plain sine
});

test('the breath stays inside 0..1, starts closed and repeats only on the joint period', () => {
  const values = samples(4000, 0.25, breath);
  for (const [i, v] of values.entries()) assert.ok(v >= 0 && v <= 1, `${i}: ${v}`);
  assert.ok(Math.abs(breath(0)) < 1e-12);
  assert.ok(Math.max(...values) > 0.99 && Math.min(...values) < 0.01, 'it uses the whole range');
  assert.ok(Math.abs(breath(123) - breath(123 + BREATH * DRIFT)) < 1e-9, 'it repeats after 28 x 37 seconds');
  assert.ok(Math.abs(breath(7) - breath(7 + BREATH)) > 0.02, 'but not on the sweep alone');
  // Nothing steps: a jump in the curve is a jump in the writing, and that is audible.
  for (let i = 1; i < values.length; i++) assert.ok(Math.abs(values[i] - values[i - 1]) < 0.03, `step at ${i}`);
});

test('register and brightness drift on the breath and nothing else', () => {
  const centres = samples(2000, 0.5, centreAt);
  for (const c of centres) assert.ok(c >= 4.6 && c <= 9.01, String(c));
  assert.ok(Math.max(...centres) - Math.min(...centres) > 4, 'the centre really travels about a fifth');
  for (const t of [0, 3, 11, 19, 47]) assert.ok(Math.abs(centreAt(t) - (4.6 + 4.4 * breath(t))) < 1e-12);
  for (const t of [0, 5, 31]) assert.equal(toneAt(t), breath(t));
  // The pointer is not an input anywhere in the graph: the user asked for the picture's clock only.
  const code = source('lib/audio/ambient.ts').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(code, /pointer|mouse|client[XY]|scroll/i);
});

test('notes fall every three to six seconds on average, and never on a grid', () => {
  const means = samples(400, 0.25, t => gapAt(t, 0.5));
  for (const g of means) assert.ok(g >= 3 && g <= 6, `${g}s`);
  assert.ok(Math.min(...means) < GAP_FAST + 0.1 && Math.max(...means) > GAP_SLOW - 0.1, 'the breath uses both ends');
  // The draw scatters each gap far enough that two in a row are never the same length.
  const scatter = Array.from({ length: 200 }, (_, i) => gapAt(13, i / 199)), middle = gapAt(13, 0.5);
  assert.ok(Math.max(...scatter) / Math.min(...scatter) > 1.7, 'the jitter is worth having');
  assert.ok(Math.min(...scatter) < middle * 0.75 && Math.max(...scatter) > middle * 1.25, 'it reaches either side of the mean');
  assert.ok(Math.min(...scatter) > 2.4, 'but never so short that two notes land on top of each other');
  const rand = mulberry32(42);
  const drawn = Array.from({ length: 500 }, () => gapAt(rand() * 100, rand()));
  const mean = drawn.reduce((sum, g) => sum + g, 0) / drawn.length;
  assert.ok(mean > 3 && mean < 6, `mean gap ${mean}s`);
  for (let i = 1; i < drawn.length; i++) assert.notEqual(drawn[i], drawn[i - 1]);
});

test('the pitch set is one fixed consonant scale over three octaves', () => {
  assert.equal(SCALE.length, 15);
  assert.deepEqual(SCALE.slice(0, 5), [0, 3, 5, 7, 10]); // minor pentatonic
  for (let i = 1; i < SCALE.length; i++) assert.ok(SCALE[i] > SCALE[i - 1], 'strictly rising');
  for (const step of SCALE) assert.ok(![1, 2, 6, 11].includes(step % 12), `${step} is outside the set`);
  assert.equal(hzOf(0), ROOT);
  assert.ok(Math.abs(hzOf(14) - 784) < 2, 'the top degree is a G5');
  for (const step of SCALE.keys()) assert.ok(hzOf(step) >= 110 && hzOf(step) <= 790);
});

test('the writing never repeats a note or an interval, and leans on the drifting centre', () => {
  const rand = mulberry32(5);
  let prev = -1, before = -1;
  const played: number[] = [];
  for (let i = 0; i < 4000; i++) {
    const step = pickStep(prev, before, centreAt(i * 4.6), rand());
    assert.ok(step >= 0 && step < SCALE.length);
    assert.notEqual(step, prev, 'the same note twice');
    if (prev >= 0 && before >= 0) assert.notEqual(step - prev, prev - before, 'the same interval twice is a motif');
    before = prev; prev = step;
    played.push(step);
  }
  // Every degree is reachable, but the middle of the range carries the piece.
  const counts = SCALE.map((_, i) => played.filter(s => s === i).length);
  for (const [i, n] of counts.entries()) assert.ok(n > 0, `degree ${i} never sounded`);
  const middle = counts.slice(4, 11).reduce((sum, n) => sum + n, 0);
  assert.ok(middle / played.length > 0.6, `only ${middle} of ${played.length} notes sat in the middle`);
  // No three-note phrase should come back often enough to be recognised as one.
  const phrases = new Map<string, number>();
  for (let i = 2; i < played.length; i++) {
    const key = played.slice(i - 2, i + 1).join(',');
    phrases.set(key, (phrases.get(key) ?? 0) + 1);
  }
  assert.ok(Math.max(...phrases.values()) / played.length < 0.01, 'a phrase repeats often enough to hum');
});

test('a rendered note is a pluck: it peaks at once and decays for seconds', () => {
  for (const step of [0, 4, 9, 14]) {
    const hz = hzOf(step), { signal, decay } = note(hz);
    assert.ok(decay >= 2 && decay <= 4, `${hz} Hz decays over ${decay}s`);
    let peak = 0, at = 0;
    for (let i = 0; i < signal.length; i++) if (Math.abs(signal[i]) > peak) { peak = Math.abs(signal[i]); at = i; }
    assert.ok(Math.abs(peak - 1) < 1e-6, `peak-normalised, got ${peak}`); // the caller's gain is the whole level
    assert.ok(at / RATE < 0.012, `${hz} Hz peaks at ${((at / RATE) * 1000).toFixed(1)}ms, which is a swell, not a pluck`);
    // A pad holds its level; a string has shed half of it before the fifth of a second is out.
    const win = Math.round(RATE * 0.05);
    const opening = rms(signal, 0, win);
    assert.ok(rms(signal, Math.round(RATE * 0.2), win) < opening * 0.5, `${hz} Hz sustains like a pad`);
    assert.ok(rms(signal, Math.round(RATE * decay * 0.5), win) < opening * 0.12, `${hz} Hz is still loud halfway through`);
    const last = Math.round(RATE * 0.02);
    assert.ok(rms(signal, signal.length - last, last) < opening * 0.01, `${hz} Hz has not finished by its own end`);
    assert.equal(Math.abs(signal[signal.length - 1]), 0, 'the buffer must land on silence or the tail is a click');
  }
});

test('the higher partials die before the fundamental does', () => {
  const win = Math.round(RATE * 0.1);
  for (const hz of [110, 220, 440]) {
    const { signal } = note(hz);
    const early = harmonic(signal, 0, win, hz * 4) / harmonic(signal, 0, win, hz);
    const late = harmonic(signal, RATE, win, hz * 4) / harmonic(signal, RATE, win, hz);
    assert.ok(late < early * 0.2, `${hz} Hz: the fourth partial holds on (${early} -> ${late})`);
  }
});

test('a brighter pluck is measurably brighter, and only the burst changes', () => {
  const win = Math.round(RATE * 0.15);
  for (const hz of [110, 440]) {
    const centroid = (tone: number) => {
      const { signal } = note(hz, tone);
      let num = 0, den = 0;
      for (let m = 1; m <= 20 && hz * m < RATE / 2; m++) {
        const power = harmonic(signal, 0, win, hz * m) ** 2;
        num += power * hz * m; den += power;
      }
      return num / den;
    };
    const dark = centroid(0), bright = centroid(1);
    assert.ok(bright > dark * 1.18, `${hz} Hz: ${dark.toFixed(0)} Hz -> ${bright.toFixed(0)} Hz is not an audible change`);
    assert.ok(bright < dark * 2, 'and it is a drift, not a filter sweep');
  }
  // Brightness must not smuggle in a different string: a harder pluck still rings for seconds.
  const win2 = Math.round(RATE * 0.05), at = Math.round(RATE * 1.2);
  const dark = note(220, 0), bright = note(220, 1);
  const ratio = rms(bright.signal, at, win2) / rms(dark.signal, at, win2);
  assert.ok(ratio > 0.45 && ratio < 2.2, `the tails diverge by ${ratio}x`);
});

test('the same seed renders the same note, and nothing renders out of range', () => {
  const a = note(330, 0.5, 11).signal, b = note(330, 0.5, 11).signal;
  assert.deepEqual(Array.from(a), Array.from(b));
  for (const step of SCALE.keys()) for (const tone of [0, 1]) {
    const { signal } = note(hzOf(step), tone, step + 1);
    for (const v of signal) assert.ok(Number.isFinite(v) && Math.abs(v) <= 1.0000001, `${hzOf(step)} Hz ran away`);
  }
});

test('the piece is quiet, and both fades are long enough not to click', () => {
  assert.ok(PEAK_GAIN > 0 && PEAK_GAIN <= 0.0708, `${PEAK_GAIN} is louder than -23 dBFS`);
  assert.ok(20 * Math.log10(PEAK_GAIN) < -23);
  assert.ok(FADE_IN >= 1 && FADE_OUT >= 1);
  // Levels only ever scale a note down, so one attack can never exceed PEAK_GAIN.
  for (const step of SCALE.keys()) for (const r of [0, 0.5, 1]) {
    const level = levelAt(step, r);
    assert.ok(level > 0.35 && level <= 1, `${level} at degree ${step}`);
  }
  assert.ok(levelAt(14, 1) < levelAt(0, 1), 'the top of the range is played more lightly');
});

test('a confirmation is a short inharmonic ping, not a note', () => {
  const total = BELL.reduce((sum, [, level]) => sum + level, 0) * CUE_GAIN;
  assert.ok(20 * Math.log10(total) < -15, `a strike can reach ${20 * Math.log10(total)} dBFS`);
  assert.ok(BELL[0][1] === 1 && BELL.every(([, level]) => level <= 1));
  for (const [ratio] of BELL.slice(1)) assert.ok(Math.abs(ratio - Math.round(ratio)) > 0.2, `${ratio} is a harmonic, not a bell`);
  for (const [, , decay] of BELL) assert.ok(decay > 0 && decay <= 0.5, `${decay}s is a tone, not a ping`);
  for (let i = 1; i < BELL.length; i++) {
    assert.ok(BELL[i][1] < BELL[i - 1][1], 'the upper partials are quieter');
    assert.ok(BELL[i][2] < BELL[i - 1][2], 'and shorter');
  }
  assert.equal(CUES.copy.length, 1);
  assert.equal(CUES.sent.length, 2);
  assert.ok(CUES.sent[1][0] > CUES.sent[0][0], 'the sent pair rises');
  assert.ok(CUES.sent[1][1] > 0 && CUES.sent[1][1] < 0.3, 'and arrives as one gesture, not two events');
});
