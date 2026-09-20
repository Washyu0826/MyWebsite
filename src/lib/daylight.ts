/* Time-of-day tint. Pure maths, no DOM: components/providers.tsx reads the visitor's clock and
   writes the result to --daylight on <html>; styles/chrome.css mixes it into the page background. */

// Warmth peaks mid-afternoon and bottoms out twelve hours later, in the small hours.
const PEAK_HOUR = 14;

/** Warmth for a local hour: 0 at the cold end of the night, 1 at the warm end of the afternoon. */
export function warmth(hour: number): number {
  // A clock we cannot read is not a reason to pick a side; sit in the middle.
  if (!Number.isFinite(hour)) return 0.5;
  const h = ((hour % 24) + 24) % 24;
  // A cosine rather than a ramp: no hour is an edge, so the shift never reads as an event.
  return (1 + Math.cos(((h - PEAK_HOUR) / 24) * Math.PI * 2)) / 2;
}

/** A Date as fractional local hours, which is all `warmth` needs. */
export function hourOf(date: Date): number {
  return date.getHours() + date.getMinutes() / 60;
}

/** The value written to the custom property. Three decimals is already finer than the eye reads. */
export function daylightValue(hour: number): string {
  return warmth(hour).toFixed(3);
}
