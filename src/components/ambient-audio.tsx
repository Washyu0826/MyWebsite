'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Volume1, VolumeX } from 'lucide-react';
type Graph = typeof import('@/lib/audio/ambient');
// Mirrors AMBIENT_KEY and readPreference in lib/audio/ambient.ts, one line rather than an import: a
// visitor who ignores the toggle must not download the audio graph to have their preference read.
// tests/audio.test.ts fails if the two drift apart.
const stored = () => { try { return localStorage.getItem('hsien-ambient') === 'on'; } catch { return false; } };
// Both live outside React: the module is loaded once per document, and the on/off state has to survive
// the component being remounted (a client-side navigation, StrictMode) without the sound gapping.
let graph: Graph | null = null, enabled: boolean | null = null;
const watchers = new Set<() => void>();
// Cached, as useSyncExternalStore requires: the server renders 'off', then hydration corrects it here.
const snapshot = () => (enabled ??= stored());
const subscribe = (fn: () => void) => { watchers.add(fn); return () => { watchers.delete(fn); }; };
// The graph arrives on the first enable, or up front for a visitor who left it on last time; a visitor
// who ignores the toggle never downloads it at all.
async function load() { return (graph ??= await import('@/lib/audio/ambient')); }
async function apply(on: boolean) {
  const mod = await load();
  mod.savePreference(on);
  const ambient = mod.acquire();
  if (on) await ambient.start();
  else ambient.stop();
}

export function AmbientAudio() {
  const t = useTranslations('Site');
  const on = useSyncExternalStore(subscribe, snapshot, () => false);
  // The live region stays empty until the visitor has actually pressed the button, so a screen reader
  // does not read the state of a control nobody touched on every page load.
  const [said, setSaid] = useState(false);
  useEffect(() => {
    // Re-acquiring on mount cancels the teardown the last unmount scheduled, which is what carries the
    // sound through a remount; it builds nothing on its own, so a first mount stays free.
    graph?.acquire();
    // A remembered 'on' cannot open a context by itself - that needs a gesture - so the first gesture
    // anywhere picks it back up. One shot either way: if that gesture was the toggle, the toggle speaks
    // for itself, and arming must not survive to restart what the visitor has just switched off.
    const arm = (e: Event) => {
      const own = e.target instanceof Element && e.target.closest('.ambient-toggle');
      disarm();
      if (!own) void apply(true);
    };
    const disarm = () => { window.removeEventListener('pointerdown', arm); window.removeEventListener('keydown', arm); };
    if (snapshot()) { void load(); window.addEventListener('pointerdown', arm); window.addEventListener('keydown', arm); }
    return () => { disarm(); graph?.release(); };
  }, []);
  const toggle = () => {
    const next = !on;
    enabled = next;
    for (const fn of watchers) fn();
    setSaid(true);
    void apply(next);
  };
  const Icon = on ? Volume1 : VolumeX;
  return <>
    <button type="button" className="ambient-toggle" data-state={on ? 'on' : 'off'} aria-label={on ? t('audioMute') : t('audioPlay')} onClick={toggle}>
      <Icon size={18} aria-hidden="true" />
    </button>
    <span role="status" className="sr-only">{said ? (on ? t('audioPlaying') : t('audioMuted')) : ''}</span>
  </>;
}
