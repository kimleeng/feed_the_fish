import { test, expect, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { PondScene } from '../../src/game.ts';
import { IDLE_DURATIONS, IDLE_HABITS, type IdleHabit } from '../../src/idles.ts';

type PondWindow = Window & { inspectedPond: PondScene };
async function watch(page: Page): Promise<void> {
  await page.addInitScript(() => document.addEventListener('pond:ready', event => {
    (window as PondWindow).inspectedPond = (event as CustomEvent<PondScene>).detail;
  }));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  await page.locator('#machine-watch').click();
}

test('every idle animates in the renderer, and birds return to directional swimming after a gesture', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await watch(page);
  const result = await page.evaluate(({ durations, pools }) => {
    const scene = (window as PondWindow).inspectedPond;
    scene.world.paused = true;
    scene.world.food = [];
    scene.world.animals.forEach(a => { a.nextIdleAt = Infinity; a.idle = null; });
    const results = [];
    for (const [habit, range] of Object.entries(durations)) {
      const animal = scene.world.animals.find(a => pools[a.profile.id].includes(habit as IdleHabit))!;
      animal.x = 600; animal.y = 389; animal.heading = 0; animal.chewLeft = 0;
      animal.idle = { habit: habit as IdleHabit, duration: range[1], elapsed: 0, heading: 0 };
      animal.state = 'idle';
      const layer = scene.children.getByName('fish-layer') as Phaser.GameObjects.Container;
      const sprite = (animal.profile.kind === 'fish' ? layer.getByName('animal-' + animal.id) : scene.children.getByName('animal-' + animal.id)) as Phaser.GameObjects.Sprite;
      const samples = new Set<string>();
      let missingFrame = false;
      for (let i = 0; i < Math.ceil(range[1] / 0.05) + 2; i++) {
        scene.world.paused = false; scene.world.step(0.05); scene.world.paused = true;
        scene.update(10000, 0);
        missingFrame ||= !sprite.texture.has(sprite.frame.name);
        samples.add(JSON.stringify([sprite.frame.name, sprite.x, sprite.y, sprite.rotation, sprite.alpha, sprite.displayWidth, sprite.displayHeight]));
      }
      results.push({ habit, samples: samples.size, missingFrame, finished: animal.idle === null, texture: sprite.texture.key, flip: sprite.flipX });
    }
    return results;
  }, { durations: IDLE_DURATIONS, pools: IDLE_HABITS });
  expect(result).toHaveLength(18);
  for (const action of result) {
    expect(action.samples, action.habit).toBeGreaterThan(1);
    expect(action.missingFrame, action.habit).toBe(false);
    expect(action.finished, action.habit).toBe(true);
    expect(action.texture, action.habit).toMatch(/^(fish|bird)-swimmers$/);
    expect(action.flip, action.habit).toBe(false);
  }
  await page.reload();
  await expect(page.locator('#loading')).toBeHidden();
  await page.locator('#machine-watch').click();
  await page.evaluate(() => {
    const scene = (window as PondWindow).inspectedPond;
    scene.world.paused = true;
    for (const [species, habit, x] of [['duck', 'preen', 420], ['gull', 'wing-stretch', 610], ['coot', 'foot-paddle', 780]] as const) {
      const a = scene.world.animals.find(a => a.profile.id === species)!;
      a.x = x; a.y = 380; a.heading = 0;
      a.idle = { habit, duration: 3, elapsed: 1.2, heading: 0 }; a.state = 'idle';
    }
    for (const p of scene.world.visitors.people) p.idle = { habit: p.signature, duration: 3, elapsed: 1.2 };
    scene.update(10000, 0);
  });
  // Keep the simulation frozen for the art review without its pause dialog obscuring the canvas.
  await page.addStyleTag({ content: '#paused-overlay { display: none !important; }' });
  await page.screenshot({ path: testInfo.outputPath('idle-gestures-desktop.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('visitors stay decorative on a phone and reset without duplication', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await watch(page);
  await page.evaluate(() => {
    const scene = (window as PondWindow).inspectedPond;
    scene.world.paused = true;
    scene.world.visitors.people[0].idle = { habit: 'hat-adjust', elapsed: 1.2, duration: 2.4 };
    scene.update(10000, 0);
  });
  await page.addStyleTag({ content: '#paused-overlay { display: none !important; }' });
  await page.screenshot({ path: testInfo.outputPath('idle-visitors-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Begin a new visit' }).click();
  const result = await page.evaluate(() => {
    const scene = (window as PondWindow).inspectedPond;
    const layer = scene.children.getByName('garden-visitors') as Phaser.GameObjects.Container;
    return { count: layer.length, interactive: layer.list.some(p => p.input), idle: scene.world.visitors.people.some(p => p.idle) };
  });
  expect(result).toEqual({ count: 4, interactive: false, idle: false });
});

test('reduced motion keeps visitor poses still while simulation commitments finish normally', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await watch(page);
  const result = await page.evaluate(() => {
    const scene = (window as PondWindow).inspectedPond;
    scene.world.paused = true;
    const person = scene.world.visitors.people[0];
    person.idle = { habit: 'hat-adjust', elapsed: 1.2, duration: 2.4 };
    scene.update(10000, 0);
    const layer = scene.children.getByName('garden-visitors') as Phaser.GameObjects.Container;
    const sprite = layer.getByName('visitor-0') as Phaser.GameObjects.Sprite;
    return { frame: sprite.frame.name, angle: sprite.angle };
  });
  expect(result).toEqual({ frame: 'visitor-0-0', angle: 0 });
});
