import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  AMBIENT_KEY, BELL, CUES, CUE_GAIN, DUCK, FADE_IN, FADE_OUT, MUSIC_GAIN,
  outputPeakDbfs, readPreference, savePreference,
} from '../src/lib/audio/ambient';
import { FORMATS, TRACK, pickFormat, trackUrl } from '../src/lib/audio/track';

const source = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const graph = source('lib/audio/ambient.ts');
/** The module with its comments stripped, for the rules that are about code and not about prose. */
const code = graph.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');

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
  // downloads the graph whether or not the visitor ever asked for sound.
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

test('the music is held a long way down, and both fades are long enough not to click', () => {
  // The brief is a recording you can ignore. The file peaks at -5.4 dBFS; the gain is what makes that
  // quiet, and this is the assertion that stops anyone raising it without meaning to.
  assert.ok(outputPeakDbfs() <= -25, `the loudest moment leaves the page at ${outputPeakDbfs().toFixed(1)} dBFS`);
  assert.ok(outputPeakDbfs() > -32, 'and not so far down that turning it on does nothing');
  assert.ok(Math.abs(outputPeakDbfs(1) - TRACK.peakDbfs) < 1e-9, 'unity gain is the file itself');
  assert.ok(MUSIC_GAIN > 0 && MUSIC_GAIN < 1);
  assert.ok(FADE_IN >= 1 && FADE_OUT >= 1, 'a fade under a second is heard as a switch');
  assert.ok(DUCK > 0 && DUCK < FADE_OUT, 'tabbing away is quicker than switching off, but not a cut');
});

test('the recording is public domain, and the credit says so', () => {
  assert.equal(TRACK.licence, 'CC0 1.0');
  assert.equal(TRACK.licenceUrl, 'https://creativecommons.org/publicdomain/zero/1.0/');
  assert.match(TRACK.sourceUrl, /^https:\/\/archive\.org\/details\//);
  // The footer credits what the graph plays, and takes both addresses from the same constant, so a
  // different piece can never be credited as this one.
  const footer = source('components/footer.tsx');
  assert.match(footer, /TRACK\.sourceUrl/);
  assert.match(footer, /TRACK\.licenceUrl/);
  assert.match(footer, /t\.rich\('audioCredit'/);
  for (const locale of ['zh', 'en'] as const) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
    const line: string = messages.Site.audioCredit;
    assert.ok(line, `${locale} has no credit line`);
    assert.match(line, /<src>Musopen<\/src>/, locale);
    assert.match(line, /<lic>CC0 1\.0<\/lic>/, locale);
    assert.match(line, /55/, `${locale} names the piece`);
  }
});

test('the file is fetched from the project\'s own Supabase bucket, or not at all', () => {
  assert.equal(trackUrl('a.opus', 'https://example.supabase.co'), 'https://example.supabase.co/storage/v1/object/public/audio/a.opus');
  assert.equal(trackUrl('a.opus', 'https://example.supabase.co/'), 'https://example.supabase.co/storage/v1/object/public/audio/a.opus');
  // No Supabase configured is silence, not a broken request to a hard-coded host. (An explicit
  // `undefined` would fall through to the default parameter, which is the env var; '' is the case
  // a missing NEXT_PUBLIC_SUPABASE_URL actually produces once Next has inlined it.)
  assert.equal(trackUrl('a.opus', ''), null);
  // And the host is never written into the source: it follows NEXT_PUBLIC_SUPABASE_URL.
  assert.doesNotMatch(source('lib/audio/track.ts').replace(/archive\.org|creativecommons\.org/g, ''), /https:\/\/[a-z0-9-]+\.supabase\.co/);
});

test('Opus is offered first and AAC is the fallback, and a browser that plays neither gets silence', () => {
  assert.equal(FORMATS.length, 2);
  assert.match(FORMATS[0].type, /opus/);
  assert.match(FORMATS[1].type, /mp4a/);
  assert.equal(pickFormat(() => 'probably'), FORMATS[0]);
  assert.equal(pickFormat(type => (type.includes('opus') ? '' : 'maybe')), FORMATS[1], 'older Safari lands on AAC');
  assert.equal(pickFormat(() => ''), null);
  // 'maybe' is an answer, not a refusal: only the empty string means no.
  assert.equal(pickFormat(type => (type.includes('opus') ? 'maybe' : 'probably')), FORMATS[0]);
});

test('nothing is downloaded, and no context is opened, before the visitor asks', () => {
  // The element is built inside media(), which start() reaches, and never at module scope.
  assert.equal((code.match(/new Audio\(/g) ?? []).length, 1);
  assert.doesNotMatch(code, /^ {0,2}(?:const|let|var)\s+\w+\s*=\s*new Audio\(/m);
  const media = code.slice(code.indexOf('const media ='), code.indexOf('const start ='));
  assert.match(media, /new Audio\(/, 'the element is built somewhere other than media()');
  assert.match(code, /preload = 'none'/);
  assert.doesNotMatch(code, /autoplay/);
  // One AudioContext, built in build(), which only start() calls.
  assert.equal((code.match(/new AudioContext\(/g) ?? []).length, 1);
  assert.match(code, /if \(!ctx\) build\(\);/);
  // Cross-origin has to be declared before the graph may read the stream, or the gain node gets silence.
  assert.match(code, /crossOrigin = 'anonymous'/);
});

test('the piece loops whole, and the graph never plays it at the file\'s own level', () => {
  assert.match(code, /\.loop = true/);
  assert.doesNotMatch(code, /volume = 1\b/);
  // The only level the music is ever ramped up to.
  const targets = [...code.matchAll(/ramp\(([^,]+),/g)].map(m => m[1].trim());
  assert.deepEqual([...new Set(targets)].sort(), ['0', 'MUSIC_GAIN']);
  // Where there is no GainNode the element's own volume is the control, and iOS ignores writes to it.
  // The graph has to read it back and refuse rather than let the file out at -5 dBFS.
  assert.match(code, /Math\.abs\(el\.volume - MUSIC_GAIN\) > 0\.01[\s\S]*broken = true/);
});

test('the sound is torn down completely, and the download with it', () => {
  const dispose = code.slice(code.indexOf('const dispose ='));
  for (const call of ['el.pause()', "el.removeAttribute('src')", 'node?.disconnect()', 'ctx?.close()']) {
    assert.ok(dispose.includes(call), `dispose does not ${call}`);
  }
  assert.match(code, /removeEventListener\('visibilitychange', onVisibility\)/);
  assert.match(code, /addEventListener\('visibilitychange', onVisibility\)/);
});

test('the pointer is not an input anywhere in the graph', () => {
  // The picture reacts to the pointer; the sound does not, and never has.
  assert.doesNotMatch(code, /pointer|mouse|client[XY]|scroll/i);
});

// The encoded files are what the gain above is calibrated against, so measure them rather than trust
// the constants. Off by default: it downloads five minutes of audio and shells out to ffmpeg, which is
// a poor fit for a pre-commit run. `AUDIO_VERIFY=1 npm test` is how you check the files after a
// re-encode or a re-upload.
const verify = process.env.AUDIO_VERIFY === '1';
const ffmpeg = (() => {
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; }
  catch { return false; }
})();

test('the published files match what TRACK claims about them', {
  skip: !verify ? 'set AUDIO_VERIFY=1 to measure the published files' : !ffmpeg && 'ffmpeg not installed',
}, async () => {
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!origin) return assert.ok(true, 'no Supabase configured in this environment');
  for (const format of FORMATS) {
    const href: string = trackUrl(format.file, origin)!;
    const response: Response = await fetch(href, { method: 'HEAD' });
    assert.equal(response.status, 200, `${format.file} is not published`);
    assert.equal(response.headers.get('content-type'), format.type.split(';')[0], format.file);
    const bytes = Number(response.headers.get('content-length'));
    assert.ok(bytes > 0 && bytes < 8 * 1024 * 1024, `${format.file} is ${bytes} bytes`);
  }
  const primary = trackUrl(FORMATS[0].file, origin)!;
  // ffmpeg writes the ebur128 report to stderr, so spawnSync rather than execFileSync, which only
  // hands back stdout.
  const run = spawnSync('ffmpeg', ['-nostdin', '-hide_banner', '-i', primary, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
    { encoding: 'utf8', timeout: 180_000 });
  assert.equal(run.status, 0, run.stderr?.slice(-400));
  const summary = run.stderr.slice(run.stderr.lastIndexOf('Summary:'));
  const read = (label: string) => Number(new RegExp(`${label}:\\s*(-?[\\d.]+)`).exec(summary)?.[1]);
  assert.ok(Math.abs(read('I') - TRACK.loudnessLufs) < 0.5, `integrated ${read('I')} LUFS, TRACK says ${TRACK.loudnessLufs}`);
  assert.ok(Math.abs(read('Peak') - TRACK.peakDbfs) < 0.5, `peak ${read('Peak')} dBFS, TRACK says ${TRACK.peakDbfs}`);
  assert.ok(read('LRA') < 8, `a ${read('LRA')} LU range is too wide to sit under a page`);
});
