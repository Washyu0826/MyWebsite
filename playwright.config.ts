import { defineConfig } from '@playwright/test';
// Local runs use the installed Google Chrome; CI installs the bundled Chromium instead.
const channel = process.env.CI ? undefined : 'chrome';
// Override with PORT=3100 when something else already occupies 3000 (e.g. a running `next dev`).
const port = Number(process.env.PORT) || 3000;
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './tests/browser', fullyParallel: false, workers: 1, timeout: 120000,
  // A CI runner under load can starve the renderer past a timeout; that is not a product defect.
  // Locally a failure should stay a failure, so the retry only applies where the noise is.
  retries: process.env.CI ? 2 : 0,
  use: { baseURL, browserName: 'chromium', channel, trace: 'off', screenshot: 'only-on-failure', launchOptions: { timeout: 30000 } },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  webServer: { command: `npm run start -- -p ${port}`, url: `${baseURL}/zh`, reuseExistingServer: !process.env.CI, timeout: 120000, env: { DEMO_MODE: 'true' } },
});
