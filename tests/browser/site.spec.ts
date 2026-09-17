import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for (const locale of ['zh', 'en']) {
  for (const colorScheme of ['light', 'dark'] as const) {
    for (const path of ['', '/projects', '/projects/document-search', '/contact']) {
    test(`${locale} / ${colorScheme} / ${path || 'home'}: mobile layout and accessibility`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        await page.goto(`/${locale}${path}`, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('html')).toHaveAttribute('lang', locale === 'zh' ? 'zh-TW' : 'en');
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.locator('html')).toHaveClass(colorScheme === 'dark' ? /dark/ : /light/);
        await expect(page.locator('body')).toHaveCSS('background-color', colorScheme === 'dark' ? 'rgb(12, 13, 16)' : 'rgb(255, 255, 255)', { timeout: 15000 });
        await page.evaluate(() => document.fonts.ready);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(result.violations).toEqual([]);
    });
    }
  }
}
test('filters use URL and preserve the current route and filter across language switch', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/zh/projects');
  await page.locator('.filter-list a').filter({ hasText: '資料／AI' }).click();
  await expect(page).toHaveURL(/tag=data-ai/);
  await expect(page.locator('.project-row')).toHaveCount(2);
  await page.getByRole('link', { name: 'Switch to English' }).click();
  await expect(page).toHaveURL(/\/en\/projects\?tag=data-ai/);
  await expect(page.locator('.project-row')).toHaveCount(2);
});
test('mobile menu traps focus, closes with Escape and returns focus to its trigger', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/zh');
  const trigger = page.getByRole('button', { name: '開啟選單' });
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
test('image lightbox supports keyboard dismissal and restores focus', async ({ page }) => {
  await page.goto('/en/projects/document-search');
  const trigger = page.getByRole('button', { name: /Enlarge image/ }).first();
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});
test('404, resume PDF and Accept-Language negotiation have usable destinations', async ({ page, request }) => {
  const response = await request.get('/', { headers: { 'Accept-Language': 'en-US,en;q=0.9' }, maxRedirects: 0 });
  expect(response.headers().location).toMatch(/\/en$/);
  const missing = await page.goto('/en/does-not-exist');
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("This file isn't here.");
  const resume = await request.get('/resume/en.pdf', { maxRedirects: 0 });
  expect(resume.status()).toBe(307);
  expect(resume.headers().location).toMatch(/\/resumes\/kuan-yu-hsien-resume-en\.pdf$/);
});
