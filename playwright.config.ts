import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', fullyParallel: false, workers: 1, timeout: 120000,
  use: { baseURL: 'http://127.0.0.1:3000', browserName: 'chromium', channel: 'chrome', trace: 'off', screenshot: 'only-on-failure', launchOptions: { timeout: 30000 } },
  reporter: [['list']],
  webServer: { command: 'npm run start', url: 'http://127.0.0.1:3000/zh', reuseExistingServer: !process.env.CI, timeout: 120000, env: { DEMO_MODE: 'true' } },
});
