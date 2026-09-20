import assert from 'node:assert/strict';
import test from 'node:test';
import { glowAt, scrollFocus } from '../src/components/glow-heading';
import { sectionActive } from '../src/components/section-reveal';

test('heading glow: full under the pointer, gone within a couple of characters', () => {
  assert.equal(glowAt(0), 1);
  assert.equal(glowAt(1.7), 0);
  assert.equal(glowAt(9), 0);
  assert.equal(glowAt(0.85).toFixed(3), '0.500');
  assert.ok(glowAt(1.2) < 0.25, 'the patch is two to three characters wide, not a lit line');
});

test('heading glow: symmetric and falling off without a step', () => {
  for (const distance of [0.2, 0.6, 1, 1.4]) assert.equal(glowAt(distance), glowAt(-distance));
  let previous = Infinity;
  for (let d = 0; d <= 2; d += 0.1) {
    const value = glowAt(d);
    assert.ok(value <= previous + 1e-9, `rises again at ${d}`);
    previous = value;
  }
});

test('heading glow: a wider span lights more characters', () => {
  assert.ok(glowAt(2, 4) > glowAt(2));
});

test('scroll fallback: the patch walks the string once, and stays on it at either end', () => {
  assert.equal(scrollFocus(0, 800, 10), 0);
  assert.equal(scrollFocus(400, 800, 10), 4.5);
  assert.equal(scrollFocus(800, 800, 10), 9);
  assert.equal(scrollFocus(4000, 800, 10), 9, 'clamped past the end');
  assert.equal(scrollFocus(-40, 800, 10), 0, 'clamped before the start');
  assert.equal(scrollFocus(200, 0, 10), 0, 'a zero span cannot divide');
  assert.equal(scrollFocus(200, 800, 1), 0, 'one character has nowhere to walk');
});

test('section bookmark: half the section on screen, or half the screen covered', () => {
  assert.equal(sectionActive(0.6, 300, 800), true);
  assert.equal(sectionActive(0.2, 200, 800), false, 'a corner of a section is not the one being read');
  assert.equal(sectionActive(0.3, 760, 800), true, 'taller than the viewport: the ratio never reaches a half');
  assert.equal(sectionActive(0, 0, 800), false);
  assert.equal(sectionActive(0.1, 100, 0), false, 'no viewport to cover');
});
