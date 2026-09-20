// The one door the rest of the site knocks on for a confirmation sound. Deliberately tiny and free of
// Web Audio: a button imports this, not the synthesis, so a visitor who never turns sound on never
// downloads the graph. Two events use it - a copied address and a sent message - and nothing else.
import type { Cue } from './ambient';

export function cue(kind: Cue): void {
  // Mirrors AMBIENT_KEY and readPreference in ./ambient, one line rather than an import, for the
  // reason above. tests/audio.test.ts fails if the copies drift apart.
  try { if (localStorage.getItem('hsien-ambient') !== 'on') return; }
  catch { return; /* no storage means no stored opt-in, so nothing to play */ }
  // No context of its own: `chime` is a no-op unless the toggle has already opened one on a gesture.
  void import('./ambient').then(mod => mod.chime(kind)).catch(() => {});
}
