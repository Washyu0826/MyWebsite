// Generative plucked-string piece for the cubist backdrop. One note every few seconds, drawn from a
// fixed pentatonic set, each one a Karplus-Strong pluck rendered from a noise burst; the tails run 2-4
// seconds and overlap, so the texture is continuous while the events are not. No bar, no progression,
// no reaction to the pointer - register, brightness and how often notes fall drift on the backdrop's
// own 28s and 37s cycles, and nothing else moves. The curves and the synthesis at the top are pure and
// are the part worth unit-testing; the graph below only wires them to Web Audio.

export const AMBIENT_KEY = 'hsien-ambient';
// The backdrop's light sweep crosses the plate every 28s and its facets drift on 20-40s cycles. The
// two cannot share state (the canvas owns its own start time, and it is not ours to edit), so they
// share the clock - performance.now() - and these periods instead; the phase differs only by the
// moment the canvas started, which is under a second into the page.
export const BREATH = 28;
export const DRIFT = 37; // a second, incommensurate cycle inside the facets' band, so the pair never repeats within a visit
export const PEAK_GAIN = 0.07; // the ceiling on one attack, -23.1 dBFS; measured output peaks near -26 and the tails far under
export const CUE_GAIN = 0.042; // the two confirmations answer a deliberate act, so they carry a little further
export const FADE_IN = 1.8, FADE_OUT = 1.2, DUCK = 0.35;
export const ROOT = 110; // A2, the note the old bed was built on
// A minor pentatonic across three octaves: no leading tone and no tritone, so any two notes land well
// together however they overlap. Degrees, not frequencies, because the weighting below works on index.
const PENT = [0, 3, 5, 7, 10];
export const SCALE = Array.from({ length: 15 }, (_, i) => 12 * Math.floor(i / 5) + PENT[i % 5]);
const SPAN = SCALE[SCALE.length - 1] / 12; // 2.83 octaves, A2 to G5
export const SPREAD = 3.4; // how far from the register centre a note may stray, in scale degrees
export const GAP_SLOW = 5.6, GAP_FAST = 3.6; // seconds between attacks at the two ends of the breath
const LONG = 4, SHORT = 2; // decay in seconds at the bottom and the top of the range
const SLACK = 1.7; // the loop is tuned to ring this much longer than asked, and the loop gain trims it back
const ATTACK = 0.004, TAIL = 0.04;

/** Only an explicit opt-in counts; anything missing, stale or unreadable means silence. The toggle and
 *  lib/audio/cue.ts each mirror this one line rather than importing it, so that reading the preference
 *  does not pull the graph below into the first-load bundle; tests/audio.test.ts fails if they drift. */
export function readPreference(raw: string | null | undefined): boolean {
  return raw === 'on';
}

export function savePreference(on: boolean): void {
  try { localStorage.setItem(AMBIENT_KEY, on ? 'on' : 'off'); }
  catch { /* a forgotten preference is the safe failure: it comes back off */ }
}

/** The breath the picture and the sound share: 0..1 on the sweep period, leaned by the slower drift. */
export function breath(t: number): number {
  const sweep = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / BREATH);
  const drift = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / DRIFT);
  return sweep * 0.68 + drift * 0.32;
}

/** Where in the scale the writing sits: low and settled when the plate is dark, up a fifth when it opens. */
export function centreAt(t: number): number {
  return 4.6 + 4.4 * breath(t);
}

/** Pluck hardness, 0..1: how much of the burst survives into the string. Brightness, heard as touch. */
export function toneAt(t: number): number {
  return breath(t);
}

/** Seconds to the next attack. `r` is one uniform draw: the breath sets the average, the draw scatters
 *  it by +-30% so no two gaps match and nothing ever reads as a pulse. */
export function gapAt(t: number, r: number): number {
  return (GAP_SLOW + (GAP_FAST - GAP_SLOW) * breath(t)) * (0.7 + 0.6 * r);
}

export function hzOf(step: number): number {
  return ROOT * 2 ** (SCALE[step] / 12);
}

/** Low strings ring longer than high ones, as they do on an instrument. */
export function decayAt(hz: number): number {
  return LONG + (SHORT - LONG) * Math.min(1, Math.max(0, Math.log2(hz / ROOT) / SPAN));
}

/** Higher notes carry further, so they are played more lightly; `r` is the stroke. */
export function levelAt(step: number, r: number): number {
  return (0.55 + 0.45 * r) * (1 - (0.3 * step) / (SCALE.length - 1));
}

/** The next degree: a bell curve around the drifting centre, minus the two moves that would start a
 *  tune - the same note twice, and the same interval twice, which is where a motif comes from. */
export function pickStep(prev: number, before: number, centre: number, r: number): number {
  const weights = SCALE.map((_, i) =>
    i === prev || (prev >= 0 && before >= 0 && i - prev === prev - before) ? 0 : Math.exp(-(((i - centre) / SPREAD) ** 2)));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let cut = r * total;
  for (const [i, w] of weights.entries()) if ((cut -= w) <= 0) return i;
  return weights.length - 1; // only reachable on a rounding edge at r = 1
}

/** Magnitude of the loop's one-pole at an angular frequency. */
function poleMag(a: number, w: number): number {
  return a / Math.hypot(1 - (1 - a) * Math.cos(w), (1 - a) * Math.sin(w));
}

/** Its inverse: the one-pole coefficient whose gain at `w` is exactly `m`. Written as the reciprocal
 *  root, because the direct quadratic goes 0/0 as m approaches 1 - which is every low note. */
function dampingFor(w: number, m: number): number {
  const q = 1 - m * m * Math.cos(w), p = 1 - m * m;
  return 1 - p / (q + Math.sqrt(Math.max(0, q * q - p * p)));
}

/** Karplus-Strong: one period of filtered noise, then a delay line fed back through a lowpass, which is
 *  a string. The loop's damping is solved for the decay asked of the fundamental, so the same call
 *  gives a 4s bottom A and a 2s top G; every partial above the fundamental sees more of that lowpass
 *  per round trip and dies correspondingly sooner, which is how a real string empties out. `tone` only
 *  shapes the burst - the hardness of the pluck, not the string. Peak-normalised to 1, with the peak
 *  inside the first few milliseconds, so the caller's gain is the whole of the level. */
export function pluck(
  out: Float32Array<ArrayBuffer>, hz: number, rate: number, tone: number, decay: number, random: () => number,
): Float32Array<ArrayBuffer> {
  const period = rate / hz, n = Math.max(2, Math.floor(period)), frac = period - n;
  const w = (2 * Math.PI * hz) / rate;
  const a = dampingFor(w, 10 ** (-3 / (hz * decay * SLACK)));
  const rho = Math.min(1, 10 ** (-3 / (hz * decay)) / poleMag(a, w));
  const c = 1 - Math.exp((-2 * Math.PI * hz * (2.2 + 7 * tone)) / rate); // burst cutoff, counted in harmonics
  let e = 0, mean = 0;
  for (let i = 0; i < n; i++) { e += c * (random() * 2 - 1 - e); out[i] = e; mean += e; }
  mean /= n;
  // A burst with an offset leaves a DC term the loop sustains for ever, and DC is a thump, not a note.
  for (let i = 0; i < n; i++) out[i] -= mean;
  const rise = Math.min(n, Math.max(1, Math.round(rate * ATTACK)));
  for (let i = 0; i < rise; i++) out[i] *= i / rise; // a few ms, only so the buffer does not open on a step
  let lp = 0;
  for (let i = n; i < out.length; i++) {
    lp += a * (out[i - n] * (1 - frac) + (i > n ? out[i - n - 1] : 0) * frac - lp); // fractional delay, then the string's loss
    out[i] = rho * lp;
  }
  const tail = Math.min(out.length, Math.round(rate * TAIL));
  for (let i = out.length - tail; i < out.length; i++) out[i] *= (out.length - 1 - i) / tail; // lands on an exact zero
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] /= peak;
  return out;
}

export type Cue = 'copy' | 'sent';
// [ratio to the strike, level, decay]. Inharmonic on purpose - struck glass, not a note - and the two
// upper partials are gone in a fifth of a second, which is what makes it read as a ping and not a tone.
export const BELL: [number, number, number][] = [[1, 1, 0.42], [2.76, 0.32, 0.19], [5.4, 0.11, 0.09]];
// Two events, and only two. [Hz, seconds after the first strike].
export const CUES: Record<Cue, [number, number][]> = {
  copy: [[1568, 0]], // one small ding: the address is on the clipboard
  sent: [[1175, 0], [1760, 0.13]], // two, rising: the message has gone
};

export type Ambient = {
  start(): Promise<void>;
  stop(): void;
  chime(kind: Cue): void;
  dispose(): void;
  playing(): boolean;
};

/** Builds nothing until `start` is called, so no context exists until the visitor asks for one. */
export function createAmbient(): Ambient {
  let ctx: AudioContext | null = null, master: GainNode | null = null, cues: GainNode | null = null;
  let voices = new Set<AudioBufferSourceNode>();
  let timer = 0, sleep = 0, want = false, last = -1, before = -1, struck = -1;
  const clock = () => performance.now() / 1000; // the backdrop's clock, so both breathe together
  const ramp = (to: number, seconds: number) => {
    if (!ctx || !master) return;
    const now = ctx.currentTime, gain = master.gain;
    gain.cancelScheduledValues(now); gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(to, now + seconds); // over a second or more, so neither edge is a click
  };
  const rest = (seconds: number) => {
    if (!ctx) return;
    ramp(0, seconds);
    window.clearTimeout(timer); timer = 0;
    window.clearTimeout(sleep);
    // Suspending mid-ramp freezes the gain where it stands and clicks on the way back: let it land first.
    sleep = window.setTimeout(() => { sleep = 0; void ctx?.suspend().catch(() => {}); }, seconds * 1000 + 80);
  };
  const onVisibility = () => { if (!want) return; if (document.hidden) rest(DUCK); else void start(); };
  // One note. The buffer is rendered here rather than pooled: 2-4 seconds of mono costs about a
  // millisecond once every few seconds, and a fresh burst is what keeps two notes from sounding alike.
  const play = (at: number, step: number, tone: number, level: number, side: number) => {
    if (!ctx || !master) return;
    const hz = hzOf(step), decay = decayAt(hz);
    const buffer = ctx.createBuffer(1, Math.round(ctx.sampleRate * decay), ctx.sampleRate);
    buffer.copyToChannel(pluck(new Float32Array(buffer.length), hz, ctx.sampleRate, tone, decay, Math.random), 0);
    const source = ctx.createBufferSource(); source.buffer = buffer;
    const place = ctx.createStereoPanner(); place.pan.value = side;
    const gain = ctx.createGain(); gain.gain.value = level;
    source.connect(place); place.connect(gain); gain.connect(master);
    source.onended = () => { voices.delete(source); source.disconnect(); place.disconnect(); gain.disconnect(); };
    source.start(at); voices.add(source);
  };
  const sow = () => {
    timer = 0;
    if (!ctx || !want || document.hidden) return;
    const t = clock(), step = pickStep(last, before, centreAt(t), Math.random());
    before = last; last = step;
    play(ctx.currentTime + 0.06, step, toneAt(t), levelAt(step, Math.random()), Math.random() * 0.9 - 0.45);
    timer = window.setTimeout(sow, gapAt(t, Math.random()) * 1000);
  };
  const chime = (kind: Cue) => {
    if (!want || !ctx || !cues || ctx.state !== 'running') return;
    const at = ctx.currentTime + 0.01;
    if (at - struck < 0.06) return; // a double press is one confirmation, not a flam
    struck = at;
    for (const [hz, offset] of CUES[kind]) {
      for (const [ratio, level, decay] of BELL) {
        const t0 = at + offset, osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.frequency.value = hz * ratio;
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(level * CUE_GAIN, t0 + 0.004);
        gain.gain.exponentialRampToValueAtTime(level * CUE_GAIN * 0.001, t0 + decay);
        gain.gain.linearRampToValueAtTime(0, t0 + decay + 0.02); // an exponential never reaches zero; land it by hand
        osc.connect(gain); gain.connect(cues);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
        osc.start(t0); osc.stop(t0 + decay + 0.04);
      }
    }
  };
  const build = () => {
    if (typeof AudioContext !== 'function') return;
    ctx = new AudioContext({ latencyHint: 'playback' }); // a larger buffer and fewer wakeups; latency means nothing here
    master = ctx.createGain(); master.gain.value = 0;
    master.connect(ctx.destination);
    // The confirmations bypass the master fade: they answer a click, so they must not arrive at
    // whatever level the 1.8s swell happens to have reached. `want` is what silences them instead.
    cues = ctx.createGain(); cues.gain.value = 1;
    cues.connect(ctx.destination);
    document.addEventListener('visibilitychange', onVisibility);
  };
  const start = async () => {
    want = true;
    if (!ctx) build();
    if (!ctx || document.hidden) return; // no Web Audio here, or nobody is looking: stay silent and stay cheap
    window.clearTimeout(sleep); sleep = 0;
    try { await ctx.resume(); }
    catch { return; } // blocked by the autoplay policy; the next gesture gets it
    if (!want || document.hidden) return; // toggled off again, or tabbed away, while the context was waking
    ramp(PEAK_GAIN, FADE_IN);
    // Two thirds of the way into the swell: late enough that the first pluck does not arrive as a
    // fade-in, early enough that pressing the button is answered inside about a second.
    if (!timer) timer = window.setTimeout(sow, FADE_IN * 660);
  };
  const stop = () => { want = false; rest(FADE_OUT); };
  const dispose = () => {
    want = false;
    document.removeEventListener('visibilitychange', onVisibility);
    window.clearTimeout(timer); window.clearTimeout(sleep); timer = 0; sleep = 0;
    for (const node of voices) { try { node.stop(); } catch { /* already finished */ } node.disconnect(); }
    voices = new Set();
    // The gain nodes go with the context; closing it is what lets the audio thread shut down.
    master?.disconnect(); cues?.disconnect();
    void ctx?.close().catch(() => {});
    ctx = null; master = null; cues = null; last = -1; before = -1;
  };
  return { start, stop, chime, dispose, playing: () => want };
}

let shared: Ambient | null = null, reaper = 0;
/** One graph per document. Holding it in the module is what carries the sound through a client-side
 *  navigation, and collecting it on a delay is what stops a remount - StrictMode, a route change that
 *  rebuilds the footer - from tearing the graph down and building it again mid-breath. */
export function acquire(): Ambient {
  window.clearTimeout(reaper); reaper = 0;
  shared ??= createAmbient();
  return shared;
}

export function release(): void {
  window.clearTimeout(reaper);
  reaper = window.setTimeout(() => { reaper = 0; shared?.dispose(); shared = null; }, 500);
}

/** Sounds only if the toggle is on and a context already exists; it never opens one of its own. */
export function chime(kind: Cue): void {
  shared?.chime(kind);
}
