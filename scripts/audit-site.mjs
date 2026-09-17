import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import { mkdirSync, writeFileSync } from 'node:fs';
const origin = 'http://localhost:3000';
mkdirSync('artifacts', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, timeout: 30000, args: ['--remote-debugging-port=9222'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${origin}/zh`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'artifacts/home-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: 'artifacts/home-mobile.png', fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto(`${origin}/en/projects/document-search`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'artifacts/project-mobile-dark.png', fullPage: true });
  const result = await lighthouse(`${origin}/zh`, {
    port: 9222, output: ['html', 'json'], logLevel: 'error',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
  });
  if (!result) throw new Error('Lighthouse did not return a report.');
  writeFileSync('artifacts/lighthouse-mobile.html', result.report[0]);
  writeFileSync('artifacts/lighthouse-mobile.json', result.report[1]);
  console.log(JSON.stringify({
    scores: Object.fromEntries(Object.entries(result.lhr.categories).map(([key, value]) => [key, Math.round(value.score * 100)])),
    failedAudits: Object.values(result.lhr.audits).filter(a => a.score !== null && a.score < 1).map(a => ({ id: a.id, title: a.title, displayValue: a.displayValue })),
  }, null, 2));
} finally { await browser.close(); }
