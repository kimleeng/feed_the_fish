import { test, expect } from '@playwright/test';

test('the pond loads, feeding reaches fish, and pause and restart work', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  await expect(page.locator('#pond canvas')).toBeVisible();
  await expect(page.locator('#food-count')).toHaveText('60');
  const pond = page.locator('#pond');
  const bounds = await pond.boundingBox();
  await pond.click({ position: { x: bounds!.width / 2, y: bounds!.height / 2 } });
  await expect(page.locator('#food-count')).toHaveText('59');
  await pond.press('Space');
  await expect(page.locator('#food-count')).toHaveText('58');
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Scatter food' }).click();
  await expect(page.locator('#food-count')).toHaveText('54');
  await expect.poll(async () => Number(await page.locator('#fish-count').textContent()), { timeout: 20_000 }).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pause game' }).click();
  await expect(page.locator('#paused-overlay')).toBeVisible();
  const clock = await page.locator('#clock').textContent();
  await page.waitForTimeout(1200);
  await expect(page.locator('#clock')).toHaveText(clock!);
  await page.getByRole('button', { name: 'Back to the pond' }).click();
  await expect(page.locator('#paused-overlay')).toBeHidden();
  await page.keyboard.press('p');
  await expect(page.locator('#paused-overlay')).toBeVisible();
  await page.keyboard.press('p');
  await expect(page.locator('#paused-overlay')).toBeHidden();
  await page.getByRole('button', { name: 'Start a new round' }).click();
  await expect(page.locator('#food-count')).toHaveText('60');
  await expect(page.locator('#fish-count')).toHaveText('0');
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('pond-desktop.png'), fullPage: true });
});

test.describe('mobile touch controls', () => {
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('the field guide shows species and mobile controls remain usable', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  await page.getByRole('button', { name: 'Field guide' }).tap();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.species-card')).toHaveCount(6);
  await expect(page.getByRole('heading', { name: 'Golden koi' })).toBeVisible();
  await page.getByRole('button', { name: 'Close field guide' }).tap();
  await expect(page.locator('#paused-overlay')).toBeHidden();
  await page.locator('#pond').tap();
  await expect(page.locator('#food-count')).toHaveText('59');
  await page.getByRole('button', { name: 'Scatter food' }).tap();
  await expect(page.locator('#food-count')).toHaveText('58');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('pond-mobile.png'), fullPage: true });
});
});
