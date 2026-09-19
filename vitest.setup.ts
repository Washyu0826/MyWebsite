import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// jsdom ships none of these, and Radix, next-themes and the cover preview all reach for them.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
class DOMRectStub {
  constructor(
    public x = 0,
    public y = 0,
    public width = 0,
    public height = 0,
  ) {}
  get top() {
    return this.y;
  }
  get left() {
    return this.x;
  }
  get right() {
    return this.x + this.width;
  }
  get bottom() {
    return this.y + this.height;
  }
  toJSON() {
    return { ...this };
  }
}

// Assigned rather than stubbed: vi.unstubAllGlobals() runs between tests and these must survive it.
Object.assign(globalThis, {
  ResizeObserver: globalThis.ResizeObserver ?? ResizeObserverStub,
  IntersectionObserver: globalThis.IntersectionObserver ?? ResizeObserverStub,
  DOMRect: globalThis.DOMRect ?? DOMRectStub,
});

/** Every query answers "no" unless a test overrides it, which is what `prefers-reduced-motion` wants here. */
export function stubMatchMedia(matches: (query: string) => boolean = () => false) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: matches(query),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

beforeEach(() => {
  stubMatchMedia();
  Element.prototype.scrollIntoView = vi.fn();
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
});

afterEach(() => {
  cleanup();
  // Components that persist drafts or theme choices would otherwise leak state into the next test.
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});
