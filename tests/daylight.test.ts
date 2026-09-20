import assert from 'node:assert/strict';
import test from 'node:test';
import { daylightValue, hourOf, warmth } from '../src/lib/daylight';

test('warmth peaks mid-afternoon and bottoms out twelve hours later', () => {
  assert.equal(warmth(14), 1);
  assert.ok(Math.abs(warmth(2)) < 1e-12);
  assert.ok(warmth(13) > 0.98 && warmth(15) > 0.98);
});

test('warmth stays inside [0, 1] for every hour, whole or fractional', () => {
  for (let i = 0; i <= 2400; i++) {
    const w = warmth(i / 100);
    assert.ok(w >= 0 && w <= 1, String(i));
  }
});

test('the clock wraps: hours outside 0-24 land on the same point of the cycle', () => {
  for (const h of [0, 3.5, 14, 21.25]) {
    assert.ok(Math.abs(warmth(h) - warmth(h + 24)) < 1e-12, String(h));
    assert.ok(Math.abs(warmth(h) - warmth(h - 24)) < 1e-12, String(h));
  }
});

test('warmth rises without a dip from the small hours to the peak, then falls back', () => {
  for (let h = 2; h < 14; h += 0.25) assert.ok(warmth(h + 0.25) > warmth(h), `rising at ${h}`);
  for (let h = 14; h < 26; h += 0.25) assert.ok(warmth(h + 0.25) < warmth(h), `falling at ${h}`);
});

test('daytime is warmer than the corresponding night hour', () => {
  for (const [day, night] of [[9, 21], [12, 0], [15, 3], [17, 5]]) assert.ok(warmth(day) > warmth(night), `${day} vs ${night}`);
  assert.ok(warmth(6) > 0.2 && warmth(6) < 0.4, 'dawn sits low but no longer at the floor');
});

test('an unreadable clock falls back to the neutral middle rather than to an extreme', () => {
  assert.equal(warmth(NaN), 0.5);
  assert.equal(warmth(Infinity), 0.5);
});

test('hourOf reads a Date as fractional local hours', () => {
  const d = new Date(2026, 8, 20, 14, 30, 0);
  assert.equal(hourOf(d), 14.5);
  assert.equal(hourOf(new Date(2026, 8, 20, 0, 0, 0)), 0);
});

test('daylightValue is a short, stable string safe to drop into a custom property', () => {
  assert.equal(daylightValue(14), '1.000');
  assert.equal(daylightValue(2), '0.000');
  assert.match(daylightValue(hourOf(new Date(2026, 8, 20, 7, 12, 0))), /^0\.\d{3}$/);
});
