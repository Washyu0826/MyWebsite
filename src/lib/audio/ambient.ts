// Generative ambient bed for the cubist backdrop. Four sine pairs on A2 and its fifth, octave and
// twelfth, each pair detuned a few cents so it beats about once every three seconds, laid over a
// pink-noise floor; all of it behind one lowpass whose cutoff breathes on the backdrop's own sweep.
// No sample, no melody, no rhythm - room tone with a little warmth, meant to stay ignorable for many
// minutes. Framework-free on purpose: the curves at the top are the part worth unit-testing.

export const AMBIENT_KEY = 'hsien-ambient';
// The backdrop's light sweep crosses the plate every 28s and its facets drift on 20-40s cycles. The
// two cannot share state (the canvas owns its own start time, and it is not ours to edit), so they
// share the clock - performance.now() - and these periods instead; the phase differs only by the
// moment the canvas started, which is under a second into the page.
export const BREATH = 28;
export const DRIFT = 37; // a second, incommensurate cycle inside the facets' band, so the pair never repeats within a visit
const LOW_HZ = 300, HIGH_HZ = 760;
export const PEAK_GAIN = 0.035; // ~-29 dBFS: present in a quiet room, lost under an open-plan office
export const FADE_IN = 1.8, FADE_OUT = 1.2, DUCK = 0.35;
const ROOT = 110; // A2: low enough to sit under the room, high enough to survive a laptop speaker
// [ratio to the root, cents between the pair, level]. Detune is picked per partial so every pair beats
// at roughly 0.3 Hz - one slow swell every three seconds, too slow to hear as a wobble.
const VOICES: [number, number, number][] = [[1, 4.7, 0.5], [1.5, 3.1, 0.3], [2, 2.4, 0.18], [3, 1.6, 0.07]];

/** Only an explicit opt-in counts; anything missing, stale or unreadable means silence. The toggle
 *  mirrors this one line rather than importing it, so that reading the preference does not pull the
 *  graph below into the first-load bundle; tests/audio.test.ts fails if the two ever drift apart. */
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

/** Lowpass cutoff in Hz. Exponential in the breath, because brightness is heard that way. */
export function cutoffAt(t: number): number {
  return LOW_HZ * (HIGH_HZ / LOW_HZ) ** breath(t);
}

/** The noise floor lifts a little as the filter opens, so the breath is felt as air and not only as tone. */
export function bedGainAt(t: number): number {
  return 0.14 + 0.08 * breath(t);
}

/** Paul Kellet's pink filter over white noise: -3 dB per octave, which is roughly what a room sounds
 *  like with nothing in it. Pure so the buffer can be checked without an AudioContext. */
export function fillPink(out: Float32Array<ArrayBuffer>, random: () => number): Float32Array<ArrayBuffer> {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < out.length; i++) {
    const w = random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return out;
}

/** Folds the tail of a noise buffer back over its head and returns the shorter, loopable part: the
 *  first sample then continues the last one exactly, so the loop is not a click every few seconds. */
export function seamless(out: Float32Array<ArrayBuffer>, fade: number): Float32Array<ArrayBuffer> {
  const keep = out.length - fade;
  for (let i = 0; i < fade; i++) {
    const k = i / fade; // equal power, or two uncorrelated stretches of noise dip 3 dB across the join
    out[i] = out[i] * Math.sqrt(k) + out[keep + i] * Math.sqrt(1 - k);
  }
  return out.subarray(0, keep);
}

export type Ambient = {
  start(): Promise<void>;
  stop(): void;
  dispose(): void;
  playing(): boolean;
};

function pinkBuffer(ctx: AudioContext): AudioBuffer {
  const fade = Math.round(ctx.sampleRate * 0.25);
  const raw = fillPink(new Float32Array(Math.round(ctx.sampleRate * 6) + fade), Math.random);
  const loop = seamless(raw, fade);
  const buffer = ctx.createBuffer(1, loop.length, ctx.sampleRate);
  buffer.copyToChannel(loop, 0);
  return buffer;
}

/** Builds nothing until `start` is called, so no context exists until the visitor asks for one. */
export function createAmbient(): Ambient {
  let ctx: AudioContext | null = null, master: GainNode | null = null;
  let tone: BiquadFilterNode | null = null, bed: GainNode | null = null;
  let sources: AudioScheduledSourceNode[] = [];
  let pulse = 0, sleep = 0, want = false;
  const clock = () => performance.now() / 1000; // the backdrop's clock, so both breathe together
  const breathe = () => {
    if (!ctx || !tone || !bed) return;
    const t = clock(), now = ctx.currentTime;
    // A target, not a step: the parameter glides between the samples we take of the page clock.
    tone.frequency.setTargetAtTime(cutoffAt(t), now, 0.6);
    bed.gain.setTargetAtTime(bedGainAt(t), now, 0.6);
  };
  const ramp = (to: number, seconds: number) => {
    if (!ctx || !master) return;
    const now = ctx.currentTime, gain = master.gain;
    gain.cancelScheduledValues(now); gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(to, now + seconds); // over a second or more, so neither edge is a click
  };
  const rest = (seconds: number) => {
    if (!ctx) return;
    ramp(0, seconds);
    window.clearInterval(pulse); pulse = 0;
    window.clearTimeout(sleep);
    // Suspending mid-ramp freezes the gain where it stands and clicks on the way back: let it land first.
    sleep = window.setTimeout(() => { sleep = 0; void ctx?.suspend().catch(() => {}); }, seconds * 1000 + 80);
  };
  const onVisibility = () => { if (!want) return; if (document.hidden) rest(DUCK); else void start(); };
  const build = () => {
    if (typeof AudioContext !== 'function') return;
    ctx = new AudioContext({ latencyHint: 'playback' }); // a larger buffer and fewer wakeups; latency means nothing here
    master = ctx.createGain(); master.gain.value = 0;
    tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.Q.value = 0.4; tone.frequency.value = cutoffAt(clock());
    tone.connect(master); master.connect(ctx.destination);
    for (const [ratio, cents, level] of VOICES) {
      const voice = ctx.createGain(); voice.gain.value = level; voice.connect(tone);
      for (const side of [-0.5, 0.5]) {
        const osc = ctx.createOscillator();
        osc.type = 'sine'; osc.frequency.value = ROOT * ratio; osc.detune.value = cents * side;
        osc.connect(voice); osc.start(); sources.push(osc);
      }
    }
    const noise = ctx.createBufferSource();
    noise.buffer = pinkBuffer(ctx); noise.loop = true;
    const rumble = ctx.createBiquadFilter();
    rumble.type = 'highpass'; rumble.frequency.value = 60; // pink noise spends most of its energy below hearing
    bed = ctx.createGain(); bed.gain.value = bedGainAt(clock());
    noise.connect(rumble); rumble.connect(bed); bed.connect(tone);
    noise.start(); sources.push(noise);
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
    ramp(PEAK_GAIN, FADE_IN); breathe();
    if (!pulse) pulse = window.setInterval(breathe, 500);
  };
  const stop = () => { want = false; rest(FADE_OUT); };
  const dispose = () => {
    want = false;
    document.removeEventListener('visibilitychange', onVisibility);
    window.clearInterval(pulse); window.clearTimeout(sleep); pulse = 0; sleep = 0;
    for (const node of sources) { try { node.stop(); } catch { /* never started, or stopped already */ } node.disconnect(); }
    sources = [];
    // The gain and filter nodes go with the context; closing it is what lets the audio thread shut down.
    master?.disconnect(); tone?.disconnect(); bed?.disconnect();
    void ctx?.close().catch(() => {});
    ctx = null; master = null; tone = null; bed = null;
  };
  return { start, stop, dispose, playing: () => want };
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
