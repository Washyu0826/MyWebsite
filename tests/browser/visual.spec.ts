import { expect, test, type Page } from '@playwright/test';

// Screenshot comparison. A baseline lives under visual.spec.ts-snapshots/ per platform, so the
// Windows set committed from the developer machine and the Linux set CI produces sit side by side.
// Run `npm run test:visual:update` after an intentional layout change and commit the new images.

// Screenshots are the flakiest thing in the suite: a loaded machine can starve the renderer long
// enough to miss a first paint. A retry costs seconds and removes a whole class of false failures.
test.describe.configure({ retries: 2 });

const themeLabel = { zh: '切換主題', en: 'Change theme' } as const;
const paper = { light: [247, 246, 241], dark: [13, 14, 16] } as const;

/** The daylight tint makes the page colour a color-mix result, so compare by distance, not string. */
async function expectPaper(page: Page, theme: 'light' | 'dark') {
  await expect(async () => {
    const value = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const parts = value.startsWith('color(')
      ? value
          .replace(/^color\(srgb\s*/, '')
          .replace(/\).*$/, '')
          .trim()
          .split(/\s+/)
          .map(v => Number(v) * 255)
      : (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    expect(parts).toHaveLength(3);
    parts.forEach((channel, index) => expect(Math.abs(channel - paper[theme][index])).toBeLessThan(16));
  }).toPass({ timeout: 15000 });
}

const routes = [
  { name: 'home', path: '' },
  { name: 'project', path: '/projects/document-search' },
  { name: 'articles', path: '/articles' },
  { name: 'contact', path: '/contact' },
] as const;

const viewports = {
  desktop: { width: 1280, height: 900 },
  mobile: { width: 375, height: 812 },
} as const;

/** Everything that moves on its own, pinned. Without this the intro reveal alone makes every shot differ. */
async function settle(page: Page, theme: 'light' | 'dark') {
  if (theme === 'light') {
    const select = page.getByRole('combobox', { name: themeLabel.zh });
    await expect(select).not.toHaveValue('system', { timeout: 15000 });
    // The select renders before React attaches its handler, so an early selectOption is swallowed
    // and the class never lands. Keep choosing until it takes.
    await expect(async () => {
      await select.selectOption('light');
      await expect(page.locator('html')).toHaveClass(/light/, { timeout: 2000 });
    }).toPass({ timeout: 20000 });
  }
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /light/, { timeout: 15000 });
  await expectPaper(page, theme);
  await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });
  // Web fonts land after first paint and move every line of text.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}

for (const { name, path } of routes) {
  for (const theme of ['dark', 'light'] as const) {
    for (const [size, viewport] of Object.entries(viewports)) {
      test(`@visual ${name} / ${theme} / ${size}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        // prefers-reduced-motion is what the components themselves check before animating.
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        await page.goto(`/zh${path}`, { waitUntil: 'domcontentloaded' });
        await settle(page, theme);

        await expect(page).toHaveScreenshot(`${name}-${theme}-${size}.png`, {
          fullPage: true,
          // Belt and braces: Playwright freezes CSS animations and transitions on its own too.
          animations: 'disabled',
          caret: 'hide',
          scale: 'css',
          // The cubist backdrop paints to a canvas from a seeded generator, but anti-aliasing on a
          // rotated facet edge is not bit-stable between runs.
          mask: [page.locator('.cubist-backdrop')],
          maxDiffPixelRatio: 0.01,
        });
      });
    }
  }
}
