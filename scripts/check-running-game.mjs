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
  await page.getByRole('button', { name: 'Pellet machine' }).click();
  await page.locator('#machine-dialog').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Insert 5 kr coin' }).click();
  await page.locator('#machine-dialog').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#food-count').textContent(), '10');
  await page.getByRole('button', { name: 'Throw pellets' }).click();
  await page.waitForFunction(() => document.querySelector('#food-count').textContent === '9');
  assert.equal(await page.locator('#money-used').textContent(), '5 kr');
  assert.deepEqual(errors, []);
  console.log('Game readiness passed: machine animation, ten-throw refill, spending, and pond throwing worked.');
} finally {
  await browser.close();
}
