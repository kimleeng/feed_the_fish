import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import type Phaser from 'phaser';
import type { PondScene } from '../../src/game.ts';
import type { PondSimulation } from '../../src/simulation.ts';

type InspectedWindow = Window & { inspectedPond: PondScene };

async function arrive(page: Page): Promise<void> {
  await page.addInitScript(() => document.addEventListener('pond:ready', event => {
    (window as InspectedWindow).inspectedPond = (event as CustomEvent<PondScene>).detail;
  }));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
}

async function visibility(page: Page) {
  return page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    const turtle = scene.world.animals.find(animal => animal.profile.kind === 'turtle')!;
    const layer = scene.children.getByName('fish-layer') as Phaser.GameObjects.Container;
    const body = layer.getByName('animal-' + turtle.id) as Phaser.GameObjects.Sprite;
    const meters = scene.children.getByName('animal-boost-meters') as Phaser.GameObjects.Graphics;
    return { debug: scene.debugMode, turtle: body.visible && body.alpha > 0,
      meters: meters.visible && meters.commandBuffer.length > 0 };
  });
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`debug mode reveals energy, live metrics, and the turtle at ${viewport.width}px without changing play`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await arrive(page);
    await expect(page.locator('#app-version')).toBeVisible();
    await expect(page.locator('#app-version')).toHaveText(/^v\d+\.\d+\.\d+\+\d+$/);
    const header = (await page.locator('.site-header').boundingBox())!;
    const version = (await page.locator('#app-version').boundingBox())!;
    expect(version.y + version.height).toBeLessThanOrEqual(header.y + header.height);
    await page.evaluate(() => {
      const scene = (window as InspectedWindow).inspectedPond;
      const Simulation = scene.world.constructor as new (seed: number, throwRoll?: () => number, behaviorRoll?: () => number) => PondSimulation;
      scene.world = new Simulation(41, undefined, () => 0);
      const world = scene.world;
      for (const animal of world.animals) animal.chewLeft = 100;
      const fish = world.animals.find(animal => animal.profile.id === 'carp')!;
      const gull = world.animals.find(animal => animal.profile.id === 'gull')!;
      const turtle = world.animals.find(animal => animal.profile.kind === 'turtle')!;
      Object.assign(fish, { x: 450, y: 389, heading: 0, chewLeft: 0, lastAteAt: 0, totalEaten: 0.65 });
      Object.assign(gull, { x: 700, y: 280, heading: Math.PI });
      gull.chewLeft = 0;
      Object.assign(turtle, { x: 600, y: 440, surfaceLeft: 0 });
      world.fishFood = 0.65;
      const food = { origin: { x: 600, y: 695 }, launchHeight: 0, amount: 1, flightTime: 0, flightDuration: 4,
        height: 0, releaseAt: 0, arcScale: 1, lucky: false, bonusClaimed: false, age: 0 };
      world.food = [
        { ...food, id: 0, throwId: 0, x: 500, y: 389, target: { x: 500, y: 389 }, phase: 'water' },
        { ...food, id: 1, throwId: 1, x: 600, y: 695, target: { x: 500, y: 389 }, phase: 'air' },
        { ...food, id: 2, throwId: 2, x: 600, y: 695, target: { x: 900, y: 389 }, phase: 'air', releaseAt: 10 },
        { ...food, id: 3, throwId: 3, x: 900, y: 500, target: { x: 900, y: 500 }, phase: 'water', age: 3 },
      ];
      world.step(0.05); world.paused = true; scene.update(1000, 0);
    });
    const debug = page.getByRole('button', { name: 'Debug mode', exact: true });
    await expect(debug).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#debug-panel')).toBeHidden();
    expect(await visibility(page)).toEqual({ debug: false, turtle: false, meters: false });
    const frozen = await page.evaluate(() => {
      const world = (window as InspectedWindow).inspectedPond.world;
      const fish = world.animals.find(animal => animal.profile.id === 'carp')!;
      if (!fish.boosting || fish.boostCharge >= 1) throw new Error('Hidden boosts must still operate.');
      return JSON.stringify({ animals: world.animals, food: world.food, elapsed: world.elapsed });
    });
    await page.screenshot({ path: testInfo.outputPath('normal-play-no-boost-meters.png'), fullPage: true });

    await debug.click();
    await expect(debug).toHaveAttribute('aria-pressed', 'true');
    await expect(debug).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#debug-panel')).toBeVisible();
    await expect(page.locator('#debug-commit')).toHaveText(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim());
    await expect(page.locator('#debug-source-state')).toHaveText(/^(Local changes|Committed source)$/);
    await expect.poll(() => visibility(page)).toEqual({ debug: true, turtle: true, meters: true });
    await expect(page.locator('#debug-animals tr')).toHaveCount(62);
    await expect(page.locator('#debug-energy')).toHaveText('61 hungry · 1 fed · 1 boosting');
    await expect(page.locator('#debug-flights')).toHaveText('1');
    await expect(page.locator('#debug-pellets')).toHaveText('1 queued · 1 air · 1 floating · 1 underwater');
    await expect(page.locator('#debug-eaten')).toHaveText('0.65 fish · 0 bird · 0 turtle');
    await expect(page.locator('#debug-machine')).toHaveText('25 servings · employee away');
    await expect(page.locator('#debug-wind')).toContainText('% strength');
    const fishRow = page.locator('#debug-animals tr').filter({ hasText: 'Common carp #13' });
    await expect(fishRow).toContainText('Recently fed');
    await expect(fishRow.locator('td').nth(3)).toHaveText('98% · active');
    await expect(fishRow.locator('td').nth(5)).toHaveText('0.65');
    const turtleRow = page.locator('#debug-animals tr').filter({ hasText: 'Musk turtle' });
    await expect(turtleRow.locator('td').nth(3)).toHaveText('—');
    expect(await page.evaluate(() => {
      const world = (window as InspectedWindow).inspectedPond.world;
      return JSON.stringify({ animals: world.animals, food: world.food, elapsed: world.elapsed });
    })).toBe(frozen);
    expect((await page.locator('#debug-panel').boundingBox())!.y).toBeGreaterThan((await page.locator('#pond').boundingBox())!.y
      + (await page.locator('#pond').boundingBox())!.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('debug-metrics-and-turtle.png'), fullPage: true });

    await page.evaluate(() => {
      const scene = (window as InspectedWindow).inspectedPond;
      scene.world.paused = false; scene.update(2000, 100); scene.togglePause();
    });
    await expect(fishRow.locator('td').nth(3)).toHaveText('93% · active');
    await expect(page.locator('#debug-clock')).toHaveText('Paused · 0.2s');
    await page.getByRole('button', { name: 'Assist mode', exact: true }).click();
    await expect(page.locator('#debug-panel')).toBeVisible();
    await debug.click();
    await expect(debug).toHaveAttribute('aria-pressed', 'false');
    await expect(debug).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#debug-panel')).toBeHidden();
    expect(await visibility(page)).toEqual({ debug: false, turtle: false, meters: false });
    await expect(page.getByRole('button', { name: 'Assist mode', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('debug preference survives reload and a new visit resets metrics while preserving debug visibility', async ({ page }) => {
  await arrive(page);
  const debug = page.getByRole('button', { name: 'Debug mode', exact: true });
  await debug.click();
  await page.reload();
  await expect(page.locator('#loading')).toBeHidden();
  await expect(debug).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => visibility(page)).toEqual({ debug: true, turtle: true, meters: true });
  await page.evaluate(() => {
    const world = (window as InspectedWindow).inspectedPond.world;
    world.handfuls = 1; world.nextThrow = { animation: 'toss', lucky: false };
  });
  await page.locator('.debug-table-scroll').focus();
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => (window as InspectedWindow).inspectedPond.world.food.length)).toBe(0);
  await page.locator('#pond').scrollIntoViewIfNeeded();
  const bounds = (await page.locator('#pond canvas').boundingBox())!;
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height * 389 / 800);
  await expect.poll(() => page.evaluate(() => (window as InspectedWindow).inspectedPond.world.food.length)).toBe(4);
  expect(await page.evaluate(() => (window as InspectedWindow).inspectedPond.world.food
    .every(food => Math.abs(food.target.x - 600) < 30 && Math.abs(food.target.y - 389) < 25))).toBe(true);
  await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    for (const animal of scene.world.animals) { animal.lastAteAt = scene.world.elapsed; animal.totalEaten = 0.5; animal.boostCharge = 0; }
    scene.world.fishFood = 5;
    scene.setDebugMode(true);
  });
  await expect(page.locator('#debug-eaten')).toHaveText('5 fish · 0 bird · 0 turtle');
  await page.getByRole('button', { name: 'Begin a new visit' }).click();
  await expect(page.locator('#debug-energy')).toHaveText('62 hungry · 0 fed · 0 boosting');
  await expect(page.locator('#debug-eaten')).toHaveText('0 fish · 0 bird · 0 turtle');
  await expect(page.locator('#debug-animals tr')).toHaveCount(62);
  await expect.poll(() => visibility(page)).toEqual({ debug: true, turtle: true, meters: true });
  await debug.click(); await page.reload();
  await expect(page.locator('#loading')).toBeHidden();
  await expect(debug).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#debug-panel')).toBeHidden();
  expect(await visibility(page)).toEqual({ debug: false, turtle: false, meters: false });
});

test('debug toggles work without storage and support keyboard activation', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('Storage unavailable'); };
    Storage.prototype.setItem = () => { throw new Error('Storage unavailable'); };
  });
  await arrive(page);
  const debug = page.getByRole('button', { name: 'Debug mode', exact: true });
  await debug.focus(); await page.keyboard.press('Space');
  await expect(debug).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#debug-panel')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(debug).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#debug-panel')).toBeHidden();
});
