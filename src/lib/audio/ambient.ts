// The site's background music and its two confirmation sounds.
//
// The music is a recording, not a synthesiser: Chopin's Nocturne in F minor, Op. 55 No. 1, from
// Musopen's Chopin set, which is dedicated to the public domain under CC0 1.0 - the performance as
// well as the composition, which is the part that actually matters and the part most "free classical
// music" downloads get wrong. It is served from Supabase Storage, streamed by an <audio> element that
// does not exist until the visitor presses the toggle, and looped whole with about two seconds of
// silence between passes.
//
// Everything audible is held down hard. The file was mastered to -19 LUFS with a 6 LU range (the raw
// take is 12.4 LU, which would put the climax three times louder than the opening), and MUSIC_GAIN
// then drops it another 20 dB, so the loudest moment of the piece leaves the page at about -25 dBFS.
//
// The confirmation chimes are still synthesised and still bypass the music's fades: they answer a
// click, so they must arrive at their own level rather than wherever a 1.8s swell has got to.

import { TRACK, pickFormat, trackUrl } from './track';
export { FORMATS, TRACK, pickFormat, trackUrl } from './track';
export type { Format } from './track';

export const AMBIENT_KEY = 'hsien-ambient';

export const MUSIC_GAIN = 0.1; // -20 dB under the file, so its peak reaches the room at about -25 dBFS
export const CUE_GAIN = 0.042;
export const FADE_IN = 1.8, FADE_OUT = 1.2, DUCK = 0.35;
const RAMP_STEP = 1 / 60; // the fallback ramp's tick, when there is no AudioParam to do it for us

/** What the loudest moment of the piece actually reaches at a given gain. The test asserts on this. */
export function outputPeakDbfs(gain: number = MUSIC_GAIN): number {
  return TRACK.peakDbfs + 20 * Math.log10(gain);
}

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

/** Builds nothing until `start` is called, so no context and no download exist until the visitor asks. */
export function createAmbient(): Ambient {
  let ctx: AudioContext | null = null, master: GainNode | null = null, cues: GainNode | null = null;
  let el: HTMLAudioElement | null = null, node: MediaElementAudioSourceNode | null = null;
  // `broken` is set once we know the music cannot be played or cannot be held down to MUSIC_GAIN.
  // Playing anyway would put the file out at its own level, twenty decibels over the brief, so the
  // graph declines instead and leaves the chimes working.
  let broken = false;
  let timer = 0, sleep = 0, want = false, struck = -1;

  /** One fade, over the AudioParam where there is one and over the element's volume where there isn't. */
  const ramp = (to: number, seconds: number) => {
    window.clearInterval(timer); timer = 0;
    if (node && master && ctx) {
      const now = ctx.currentTime, gain = master.gain;
      gain.cancelScheduledValues(now); gain.setValueAtTime(gain.value, now);
      gain.linearRampToValueAtTime(to, now + seconds); // over a second or more, so neither edge is a click
      return;
    }
    if (!el) return;
    const from = el.volume, steps = Math.max(1, Math.round(seconds / RAMP_STEP));
    let i = 0;
    timer = window.setInterval(() => {
      if (!el) { window.clearInterval(timer); timer = 0; return; }
      i += 1;
      el.volume = Math.min(1, Math.max(0, from + (to - from) * (i / steps)));
      if (i >= steps) { window.clearInterval(timer); timer = 0; }
    }, RAMP_STEP * 1000);
  };
  const rest = (seconds: number) => {
    ramp(0, seconds);
    window.clearTimeout(sleep);
    // Pausing or suspending mid-fade freezes the level where it stands and clicks on the way back:
    // let the ramp land first.
    sleep = window.setTimeout(() => {
      sleep = 0;
      el?.pause();
      void ctx?.suspend().catch(() => {});
    }, seconds * 1000 + 80);
  };
  const onVisibility = () => { if (!want) return; if (document.hidden) rest(DUCK); else void start(); };

  const chime = (kind: Cue) => {
    if (!want || !ctx || !cues || ctx.state !== 'running') return;
    const at = ctx.currentTime + 0.01;
    if (at - struck < 0.06) return; // a double press is one confirmation, not a flam
    struck = at;
    for (const [hz, offset] of CUES[kind]) {
      for (const [ratio, loud, decay] of BELL) {
        const t0 = at + offset, osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.frequency.value = hz * ratio;
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(loud * CUE_GAIN, t0 + 0.004);
        gain.gain.exponentialRampToValueAtTime(loud * CUE_GAIN * 0.001, t0 + decay);
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

  /** The element, and with it the download, on first use only. */
  const media = (): HTMLAudioElement | null => {
    if (broken) return null;
    if (el) return el;
    if (typeof Audio !== 'function') { broken = true; return null; }
    const candidate = new Audio();
    const format = pickFormat(type => candidate.canPlayType(type));
    const src = format && trackUrl(format.file);
    if (!src) { broken = true; return null; } // no playable format, or no Supabase: chimes only
    candidate.crossOrigin = 'anonymous'; // required before the graph may read the stream
    candidate.loop = true;
    candidate.preload = 'none'; // nothing leaves the network until play() below
    candidate.src = src;
    candidate.addEventListener('error', () => { broken = true; });
    el = candidate;
    if (ctx && master) {
      try { node = ctx.createMediaElementSource(el); node.connect(master); }
      catch { node = null; } // no route through the graph; the element's own volume is all we have
    }
    if (!node) {
      // Without a GainNode the element's volume is the only control, and iOS ignores it outright.
      // Verify it before anything can be heard rather than play the file at its own level.
      el.volume = MUSIC_GAIN;
      if (Math.abs(el.volume - MUSIC_GAIN) > 0.01) { broken = true; el = null; return null; }
      el.volume = 0;
    }
    return el;
  };

  const start = async () => {
    want = true;
    if (!ctx) build();
    if (document.hidden) return; // nobody is looking: stay silent and stay cheap
    window.clearTimeout(sleep); sleep = 0;
    if (ctx) { try { await ctx.resume(); } catch { /* the chimes wait for the next gesture */ } }
    if (!want || document.hidden) return; // toggled off again, or tabbed away, while the context was waking
    const player = media();
    if (!player) return;
    try { await player.play(); }
    catch { return; } // blocked by the autoplay policy; the next gesture gets it
    if (!want || document.hidden) { player.pause(); return; }
    ramp(MUSIC_GAIN, FADE_IN);
  };
  const stop = () => { want = false; rest(FADE_OUT); };
  const dispose = () => {
    want = false;
    document.removeEventListener('visibilitychange', onVisibility);
    window.clearInterval(timer); window.clearTimeout(sleep); timer = 0; sleep = 0;
    if (el) {
      el.pause();
      el.removeAttribute('src'); // stops a paused element from finishing the download in the background
      el.load();
    }
    node?.disconnect(); node = null; el = null;
    // The gain nodes go with the context; closing it is what lets the audio thread shut down.
    master?.disconnect(); cues?.disconnect();
    void ctx?.close().catch(() => {});
    ctx = null; master = null; cues = null; broken = false;
  };
  return { start, stop, chime, dispose, playing: () => want };
}

let shared: Ambient | null = null, reaper = 0;
/** One graph per document. Holding it in the module is what carries the sound through a client-side
 *  navigation, and collecting it on a delay is what stops a remount - StrictMode, a route change that
 *  rebuilds the footer - from tearing the graph down and building it again mid-phrase. */
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
