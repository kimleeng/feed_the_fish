import { test, expect, type Page } from '@playwright/test';

async function arrive(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  await expect(page.locator('#machine-dialog')).toBeVisible();
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('#machine-dialog img')].every(image => image.complete && image.naturalWidth > 0));
}
async function buy(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Insert 5 kr coin' }).click();
  await expect(page.locator('#machine-dialog')).toBeHidden({ timeout: 10_000 });
}

test('the opening animates the coin and crank, grants twenty throws, and feeds an untimed pond', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await arrive(page);
  await expect(page.locator('#food-count')).toHaveText('0');
  await expect(page.getByRole('button', { name: 'Insert 5 kr coin' })).toBeFocused();
  await expect(page.locator('#clock')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('pellet-machine.png'), fullPage: true });
  await page.getByRole('button', { name: 'Insert 5 kr coin' }).click();
  await expect(page.locator('#vending-stage')).toHaveAttribute('data-phase', 'turning');
  await expect.poll(() => page.locator('.machine-handle').evaluate(handle => getComputedStyle(handle).transform)).not.toBe('none');
  await expect(page.locator('#machine-coins')).toHaveText('1');
  await expect(page.locator('#food-count')).toHaveText('0');
  await expect(page.locator('#machine-dialog')).toBeHidden({ timeout: 10_000 });
  await expect(page.locator('#food-count')).toHaveText('20');
  await expect(page.locator('#money-used')).toHaveText('5 kr');

  const pond = page.locator('#pond');
  const bounds = await pond.boundingBox();
  await pond.click({ position: { x: bounds!.width / 2, y: bounds!.height / 2 } });
  await pond.press('Space');
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Throw pellets' }).click();
  await expect(page.locator('#food-count')).toHaveText('16');
  await expect.poll(async () => Number(await page.locator('#score').textContent()), { timeout: 20_000 }).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pause game' }).click();
  await expect(page.locator('#paused-overlay')).toBeVisible();
  const score = await page.locator('#score').textContent();
  await page.waitForTimeout(1000);
  await expect(page.locator('#score')).toHaveText(score!);
  await page.getByRole('button', { name: 'Back to the pond' }).click();
  await page.keyboard.press('p');
  await expect(page.locator('#paused-overlay')).toBeVisible();
  await page.keyboard.press('p');
  await expect(page.locator('#paused-overlay')).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('zen-pond-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Begin a new visit' }).click();
  await expect(page.locator('#machine-dialog')).toBeVisible();
  await expect(page.locator('#food-count')).toHaveText('0');
  await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('#money-used')).toHaveText('0 kr');
  expect(errors).toEqual([]);
});

test('empty hands can be refilled, collection is visible, and each coin is counted once', async ({ page }, testInfo) => {
  await arrive(page);
  await buy(page);
  for (let i = 0; i < 20; i++) await page.getByRole('button', { name: 'Throw pellets' }).click();
  await expect(page.locator('#food-count')).toHaveText('0');
  await expect(page.locator('#machine-dialog')).toBeHidden();
  await page.getByRole('button', { name: 'Pellet machine' }).click();
  await expect(page.locator('#machine-total')).toHaveText('5 kr');
  await page.getByRole('button', { name: 'Insert 5 kr coin' }).click();
  await expect(page.getByRole('button', { name: 'Insert 5 kr coin' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.locator('#machine-dialog')).toBeVisible();
  await expect(page.locator('#vending-stage')).toHaveAttribute('data-phase', 'collecting');
  await expect(page.locator('#food-count')).toHaveText('0');
  await expect.poll(() => page.locator('.collection-hand').evaluate(hand => Number(getComputedStyle(hand).opacity)), { intervals: [50] }).toBeGreaterThan(0.5);
  await page.screenshot({ path: testInfo.outputPath('collecting-pellets.png'), fullPage: true });
  await expect(page.locator('#machine-dialog')).toBeHidden();
  await expect(page.locator('#food-count')).toHaveText('20');
  await expect(page.locator('#money-used')).toHaveText('10 kr');
  await page.getByRole('button', { name: 'Pellet machine' }).click();
  await expect(page.locator('#machine-coins')).toHaveText('2');
  await page.getByRole('button', { name: 'Close pellet machine' }).click();
});

test.describe('mobile touch controls', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('the coin machine, touch throwing, and field guide work on a phone', async ({ page }, testInfo) => {
    await arrive(page);
    await page.screenshot({ path: testInfo.outputPath('pellet-machine-mobile.png'), fullPage: true });
    await page.getByRole('button', { name: 'Insert 5 kr coin' }).tap();
    await expect(page.locator('#machine-dialog')).toBeHidden({ timeout: 10_000 });
    await expect(page.locator('#food-count')).toHaveText('20');
    await page.getByRole('button', { name: 'Field guide' }).tap();
    await expect(page.locator('#guide-dialog')).toBeVisible();
    await expect(page.locator('.species-card')).toHaveCount(6);
    await page.getByRole('button', { name: 'Close field guide' }).tap();
    await expect(page.locator('#paused-overlay')).toBeHidden();
    await page.locator('#pond').tap();
    await page.getByRole('button', { name: 'Throw pellets' }).tap();
    await expect(page.locator('#food-count')).toHaveText('18');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('zen-pond-mobile.png'), fullPage: true });
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('refills complete correctly when decorative animation is reduced', async ({ page }) => {
    await arrive(page);
    await page.keyboard.press('Enter');
    await expect(page.locator('#machine-dialog')).toBeHidden({ timeout: 10_000 });
    await expect(page.locator('#food-count')).toHaveText('20');
    await expect(page.locator('#money-used')).toHaveText('5 kr');
  });
});
