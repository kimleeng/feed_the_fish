import { defineConfig } from '@playwright/test';

const production = process.env.FEED_FISH_TEST_MODE === 'production';
export default defineConfig({
  testDir: './tests/browser', workers: 1, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5173', headless: true, launchOptions: { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium' } },
  webServer: {
    command: production ? 'npm run preview -- --port 5173 --strictPort' : 'npm run dev -- --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173', reuseExistingServer: false, timeout: 30_000,
  },
});
