import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
  headless: true,
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto(process.argv[2] || 'http://127.0.0.1:5173');
  assert.equal(response.status(), 200);
  await page.locator('#loading').waitFor({ state: 'hidden' });
  await page.locator('#pond canvas').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Scatter food' }).click();
  await page.waitForFunction(() => document.querySelector('#food-count').textContent === '59');
  assert.deepEqual(errors, []);
  console.log('Game readiness passed: original art loaded, canvas rendered, and feeding input worked.');
} finally {
  await browser.close();
}
