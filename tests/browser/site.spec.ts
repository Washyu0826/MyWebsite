import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const themeLabel = { zh: '切換主題', en: 'Change theme' } as const;
const paper = { light: 'rgb(247, 246, 241)', dark: 'rgb(13, 14, 16)' } as const;
// The default theme is a fixed `dark`; light is opted into through the theme <select>.
async function chooseTheme(page: Page, locale: 'zh' | 'en', theme: 'light' | 'dark') {
  const select = page.getByRole('combobox', { name: themeLabel[locale] });
  await expect(select).not.toHaveValue('system');
  await select.selectOption(theme);
}
for (const locale of ['zh', 'en'] as const) {
  for (const colorScheme of ['light', 'dark'] as const) {
    for (const path of ['', '/projects', '/projects/document-search', '/contact']) {
    test(`${locale} / ${colorScheme} / ${path || 'home'}: mobile layout and accessibility`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        await page.goto(`/${locale}${path}`, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('html')).toHaveAttribute('lang', locale === 'zh' ? 'zh-TW' : 'en');
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.locator('html')).toHaveClass(/dark/);
        if (colorScheme === 'light') await chooseTheme(page, locale, 'light');
        await expect(page.locator('html')).toHaveClass(colorScheme === 'dark' ? /dark/ : /light/);
        await expect(page.locator('body')).toHaveCSS('background-color', paper[colorScheme], { timeout: 15000 });
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
  const unknown = await request.get('/resume/xx.pdf', { maxRedirects: 0 });
  expect(unknown.status()).toBe(404);
});
for (const [locale, navLabel] of [['zh', '文章'], ['en', 'Notes']] as const) {
  test(`${locale}: articles index renders translated heading and navigation link`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/${locale}/articles`, { waitUntil: 'domcontentloaded' });
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).not.toContainText('Articles.title');
    await expect(page.getByRole('navigation').getByRole('link', { name: navLabel, exact: true })).toBeVisible();
  });
}
test('admin pages redirect to the login screen when signed out', async ({ page }) => {
  for (const path of ['/admin', '/admin/files']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/admin\/login/);
  }
});
test('contact page exposes a form with a submit button', async ({ page }) => {
  await page.goto('/zh/contact', { waitUntil: 'domcontentloaded' });
  const form = page.locator('form').first();
  await expect(form).toBeVisible();
  await expect(form.getByRole('button', { name: /送出|傳送|Send|Submit/ })).toBeVisible();
});

test('command palette opens with the keyboard, filters and navigates', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/zh');
  await page.keyboard.press('Control+k');
  const panel = page.locator('.command-panel');
  await expect(panel).toBeVisible();
  await panel.locator('.command-input').fill('data');
  await expect(panel.locator('.command-item')).not.toHaveCount(0);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/zh\/projects\//);
  await page.keyboard.press('Control+k');
  await expect(panel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
});
