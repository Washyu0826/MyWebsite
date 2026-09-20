import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  AMBIENT_KEY, BREATH, DRIFT, FADE_IN, FADE_OUT, PEAK_GAIN,
  bedGainAt, breath, cutoffAt, fillPink, readPreference, savePreference, seamless,
} from '../src/lib/audio/ambient';
import { mulberry32 } from '../src/components/cubist-backdrop';

const source = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const samples = (n: number, step: number, f: (t: number) => number) => Array.from({ length: n }, (_, i) => f(i * step));

test('only an explicit opt-in counts as on', () => {
  assert.equal(readPreference('on'), true);
  for (const raw of [null, undefined, '', 'off', 'ON', 'true', '1', 'yes', ' on']) assert.equal(readPreference(raw), false, String(raw));
});

test('the preference survives a browser with no storage at all', () => {
  // Node has no localStorage, which is the same ReferenceError a locked-down private window throws.
  assert.doesNotThrow(() => savePreference(true));
  assert.doesNotThrow(() => savePreference(false));
});

test('the toggle and the graph agree on the storage key', () => {
  // The component repeats the key rather than importing it, so that reading the preference does not
  // pull the audio graph into the first-load bundle. This is what keeps the two copies honest.
  assert.match(source('components/ambient-audio.tsx'), new RegExp(`localStorage\\.getItem\\('${AMBIENT_KEY}'\\) === 'on'`));
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
  // Nothing steps: a jump in the curve is a jump in the filter, and that is audible.
  for (let i = 1; i < values.length; i++) assert.ok(Math.abs(values[i] - values[i - 1]) < 0.03, `step at ${i}`);
});

test('the cutoff stays in the warm part of the band and tracks the breath', () => {
  const values = samples(2000, 0.5, cutoffAt);
  for (const hz of values) assert.ok(hz >= 300 && hz <= 760, `${hz} Hz`);
  // Nothing above a whisper of the spectrum gets through: the ear reads it as a room, not as an instrument.
  assert.ok(Math.max(...values) < 1000);
  for (const t of [0, 3, 11, 19, 47]) assert.ok(Math.abs(cutoffAt(t) - 300 * (760 / 300) ** breath(t)) < 1e-9, 'exponential in the breath');
});

test('the noise floor is a floor: quiet, and it only ever leans on the breath', () => {
  const values = samples(2000, 0.5, bedGainAt);
  for (const g of values) assert.ok(g >= 0.14 && g <= 0.22, String(g));
  assert.ok(Math.max(...values) - Math.min(...values) < 0.1, 'the bed never swells into an event');
});

test('the bed is fixed and quiet, and both fades are long enough not to click', () => {
  assert.ok(PEAK_GAIN > 0 && PEAK_GAIN <= 0.05, `${PEAK_GAIN} is not a background`); // <= about -26 dBFS
  assert.ok(FADE_IN >= 1 && FADE_OUT >= 1);
});

test('the noise is pink, bounded and the same for a given source of randomness', () => {
  const pink = fillPink(new Float32Array(48000), mulberry32(7));
  assert.deepEqual(Array.from(fillPink(new Float32Array(48000), mulberry32(7))), Array.from(pink));
  let peak = 0, sum = 0, square = 0;
  for (const v of pink) { peak = Math.max(peak, Math.abs(v)); sum += v; square += v * v; }
  const rms = Math.sqrt(square / pink.length);
  assert.ok(peak < 1, `peak ${peak}`); // it feeds a gain of its own, but never arrives already clipped
  assert.ok(rms > 0.1 && rms < 0.35, `rms ${rms}`);
  // 1/f wanders below the lowest note by definition, so this only checks it does not run away; the
  // highpass in front of the bed is what actually takes the sub-audible part out.
  assert.ok(Math.abs(sum / pink.length) < rms / 2, 'the wander stays under the signal');
  // Pink is white tilted down 3 dB an octave, so neighbouring samples are correlated; white's are not.
  const rand = mulberry32(7);
  const white = Float32Array.from({ length: 48000 }, () => rand() * 2 - 1);
  assert.ok(lag1(pink) > 0.7, `pink lag-1 ${lag1(pink)}`);
  assert.ok(Math.abs(lag1(white)) < 0.05, `white lag-1 ${lag1(white)}`);
});

test('the loop point continues the signal instead of cutting it', () => {
  const fade = 2000, raw = fillPink(new Float32Array(20000), mulberry32(11));
  const before = Float32Array.from(raw);
  const loop = seamless(raw, fade);
  assert.equal(loop.length, 20000 - fade);
  // The first sample now *is* the sample that followed the last one, so wrapping round is not a step.
  assert.ok(Math.abs(loop[0] - before[20000 - fade]) < 1e-6);
  const seam = Math.abs(loop[0] - loop[loop.length - 1]);
  let worst = 0;
  for (let i = 1; i < loop.length; i++) worst = Math.max(worst, Math.abs(loop[i] - loop[i - 1]));
  assert.ok(seam <= worst, `the join (${seam}) is no sharper than the noise itself (${worst})`);
});

function lag1(signal: Float32Array) {
  let mean = 0;
  for (const v of signal) mean += v;
  mean /= signal.length;
  let cov = 0, variance = 0;
  for (let i = 1; i < signal.length; i++) cov += (signal[i] - mean) * (signal[i - 1] - mean);
  for (const v of signal) variance += (v - mean) ** 2;
  return cov / variance;
}
