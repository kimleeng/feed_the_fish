import { test, expect, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { PondScene } from '../../src/game.ts';
import type { PondSimulation } from '../../src/simulation.ts';

type InspectedWindow = Window & { inspectedPond: PondScene };

async function arrive(page: Page): Promise<void> {
  await page.addInitScript(() => {
    document.addEventListener('pond:ready', event => {
      (window as InspectedWindow).inspectedPond = (event as CustomEvent<PondScene>).detail;
    });
  });
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  await expect(page.locator('#machine-dialog')).toBeVisible();
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('#machine-dialog img')].every(image => image.complete && image.naturalWidth > 0));
}
async function buy(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Insert 5 kr coin' }).click();
  await expect(page.locator('#machine-dialog')).toBeHidden({ timeout: 10_000 });
}

test('swimmers turn through eight views, and visible fish sit beneath the water surface', async ({ page }, testInfo) => {
  await arrive(page);
  await page.locator('#machine-watch').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: testInfo.outputPath('swimming-pond.png'), fullPage: true });

  const pixels = await page.evaluate(async () => {
    const scene = (window as InspectedWindow).inspectedPond;
    scene.world.paused = true;
    const fish = scene.children.getByName('fish-layer') as Phaser.GameObjects.Container;
    const water = scene.children.getByName('water-surface') as Phaser.GameObjects.Container;
    const snapshot = async () => {
      // Let Phaser paint the requested visibility before reading the actual canvas.
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const canvas = scene.game.canvas;
      return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const submerged = await snapshot();
    fish.setVisible(false);
    const withoutFish = await snapshot();
    fish.setVisible(true); water.setVisible(false);
    const uncovered = await snapshot();
    water.setVisible(true);
    const changedPixels = (first: Uint8ClampedArray, second: Uint8ClampedArray) => {
      let count = 0;
      for (let i = 0; i < first.length; i += 4) {
        if (Math.abs(first[i] - second[i]) + Math.abs(first[i + 1] - second[i + 1]) + Math.abs(first[i + 2] - second[i + 2]) > 30) count++;
      }
      return count;
    };
    return { visibleFish: changedPixels(submerged, withoutFish), waterObscuresFish: changedPixels(submerged, uncovered) };
  });
  expect(pixels.visibleFish).toBeGreaterThan(500);
  expect(pixels.waterObscuresFish).toBeGreaterThan(500);

  const directions = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
  for (let heading = 0; heading < 8; heading++) {
    const rendered = await page.evaluate(index => {
      const scene = (window as InspectedWindow).inspectedPond;
      scene.world.paused = true;
      for (const animal of scene.world.animals) animal.heading = index * Math.PI / 4;
      scene.update(1000, 0);
      const surface = scene.children.getByName('water-surface') as Phaser.GameObjects.Container;
      const fishLayer = scene.children.getByName('fish-layer') as Phaser.GameObjects.Container;
      return {
        waterAlpha: surface.alpha,
        animals: scene.world.animals.map(animal => {
          const sprite = (animal.profile.kind === 'fish' ? fishLayer.getByName('animal-' + animal.id)
            : scene.children.getByName('animal-' + animal.id)) as Phaser.GameObjects.Sprite;
          return {
            species: animal.profile.id, kind: animal.profile.kind, frame: sprite.frame.name,
            atlas: sprite.texture.key, depth: sprite.parentContainer?.depth ?? sprite.depth, waterDepth: surface.depth,
            alpha: sprite.alpha, masked: !!sprite.parentContainer?.mask, flipped: sprite.flipX,
            frameExists: sprite.texture.has(sprite.frame.name),
          };
        }),
      };
    }, heading);
    expect(rendered.waterAlpha).toBeGreaterThan(0.2);
    expect(rendered.waterAlpha).toBeLessThan(0.5);
    for (const animal of rendered.animals) {
      expect(animal.frame).toMatch(new RegExp(`^${animal.species}-${directions[heading]}-[01]$`));
      expect(animal.frameExists).toBe(true);
      expect(animal.flipped).toBe(false);
      if (animal.kind === 'fish') {
        expect(animal.atlas).toBe('fish-swimmers');
        expect(animal.depth).toBeLessThan(animal.waterDepth);
        expect(animal.alpha).toBeGreaterThan(0.6);
        expect(animal.masked).toBe(true);
      } else {
        expect(animal.atlas).toBe('bird-swimmers');
        expect(animal.depth).toBeGreaterThan(animal.waterDepth);
      }
    }
  }
  await page.evaluate(() => { (window as InspectedWindow).inspectedPond.world.paused = false; });
  const birdPoses = new Set<string>();
  await expect.poll(async () => {
    const pose = await page.evaluate(() => {
      const scene = (window as InspectedWindow).inspectedPond;
      const bird = scene.world.animals.find(animal => animal.profile.id === 'duck')!;
      const sprite = scene.children.getByName('animal-' + bird.id) as Phaser.GameObjects.Sprite;
      return sprite.frame.name.split('-').at(-1)!;
    });
    birdPoses.add(pose);
    return birdPoses.size;
  }, { timeout: 5000 }).toBe(2);
  await page.getByRole('button', { name: 'Field guide' }).click();
  await expect(page.getByRole('heading', { name: 'Little coot' })).toBeVisible();
  expect(await page.locator('.species-art').evaluateAll(images =>
    images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('swimming-field-guide.png'), fullPage: true });
});

test('three hand motions keep the sleeve edge off-screen, and a lucky fish bite celebrates its bonus', async ({ page }, testInfo) => {
  await arrive(page);
  await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    const Simulation = scene.world.constructor as new (seed: number, roll?: () => number) => PondSimulation;
    const rolls = [0.1, 0.5, 0.75, 0.5, 0.95, 0.01, 0.1, 0.5];
    scene.world = new Simulation(1234, () => rolls.shift() ?? 0.5);
  });
  await buy(page);

  for (const animation of ['toss', 'sweep', 'lob']) {
    if (animation === 'lob') {
      await expect.poll(() => page.evaluate(() => {
        const rig = (window as InspectedWindow).inspectedPond.children.getByName('throwing-hand') as Phaser.GameObjects.Container;
        return rig.getByName('lucky-hand-indicator').visible;
      })).toBe(true);
      await expect(page.locator('#visit-note')).toContainText('golden pellet');
      await page.screenshot({ path: testInfo.outputPath('lucky-pellet-in-hand.png'), fullPage: true });
    }
    await page.getByRole('button', { name: 'Throw pellets' }).click();
    const frames = await page.evaluate(async expected => {
      const scene = (window as InspectedWindow).inspectedPond;
      const rig = scene.children.getByName('throwing-hand') as Phaser.GameObjects.Container;
      const image = rig.getByName('hand-art') as Phaser.GameObjects.Image;
      const action = scene.world.currentThrow!;
      if (action.animation !== expected) throw new Error('Wrong throw animation');
      const result: { x: number; y: number; leftBottom: number; rightBottom: number; canvasHeight: number }[] = [];
      await new Promise<void>(resolve => {
        const sample = () => {
          if (scene.world.currentThrow?.id !== action.id) { resolve(); return; }
          const transform = image.getWorldTransformMatrix();
          const left = transform.transformPoint(-image.displayOriginX, image.height - image.displayOriginY);
          const right = transform.transformPoint(image.width - image.displayOriginX, image.height - image.displayOriginY);
          result.push({ x: rig.x, y: rig.y, leftBottom: left.y, rightBottom: right.y, canvasHeight: scene.game.canvas.height });
          requestAnimationFrame(sample);
        };
        sample();
      });
      return result;
    }, animation);
    expect(frames.length).toBeGreaterThan(5);
    for (const frame of frames) {
      expect(frame.leftBottom).toBeGreaterThan(frame.canvasHeight);
      expect(frame.rightBottom).toBeGreaterThan(frame.canvasHeight);
    }
    if (animation === 'toss') expect(frames.every(frame => Math.abs(frame.x - 600) < 0.01)).toBe(true);
    if (animation === 'sweep') expect(Math.max(...frames.map(frame => Math.abs(frame.x - 600)))).toBeGreaterThan(15);
    if (animation === 'lob') expect(Math.min(...frames.map(frame => frame.y))).toBeLessThan(678);
  }
  await expect(page.locator('#food-count')).toHaveText('17');
  await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    const pellet = scene.world.food.find(food => food.lucky)!;
    scene.world.food = [pellet];
    const fish = scene.world.animals.find(animal => animal.profile.id === 'minnow')!;
    for (const animal of scene.world.animals) { animal.chewLeft = 5; animal.state = 'chewing'; }
    fish.x = pellet.target.x; fish.y = pellet.target.y; fish.chewLeft = 0;
  });
  await expect.poll(() => page.evaluate(() => (window as InspectedWindow).inspectedPond.world.luckyBonus)).toBe(50);
  await expect(page.locator('#lucky-bonus')).toBeVisible();
  await expect(page.locator('#lucky-bonus')).toContainText('+50');
  await expect.poll(() => page.evaluate(() => !!(window as InspectedWindow).inspectedPond.children.getByName('lucky-celebration'))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('lucky-fish-bonus.png'), fullPage: true });
  await page.getByRole('button', { name: 'Begin a new visit' }).click();
  await expect(page.locator('#lucky-bonus')).toBeHidden();
  expect(await page.evaluate(() => (window as InspectedWindow).inspectedPond.world.pendingThrows)).toBe(0);
  expect(await page.evaluate(() => !!(window as InspectedWindow).inspectedPond.children.getByName('lucky-celebration'))).toBe(false);
});

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
    await page.evaluate(() => {
      const scene = (window as InspectedWindow).inspectedPond;
      const Simulation = scene.world.constructor as new (seed: number, roll?: () => number) => PondSimulation;
      scene.world = new Simulation(2345, () => 0.01);
    });
    await page.screenshot({ path: testInfo.outputPath('pellet-machine-mobile.png'), fullPage: true });
    await page.getByRole('button', { name: 'Insert 5 kr coin' }).tap();
    await expect(page.locator('#machine-dialog')).toBeHidden({ timeout: 10_000 });
    await expect(page.locator('#food-count')).toHaveText('20');
    await expect.poll(() => page.evaluate(() => {
      const rig = (window as InspectedWindow).inspectedPond.children.getByName('throwing-hand') as Phaser.GameObjects.Container;
      return rig.getByName('lucky-hand-indicator').visible;
    })).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('lucky-hand-mobile.png'), fullPage: true });
    await page.getByRole('button', { name: 'Field guide' }).tap();
    await expect(page.locator('#guide-dialog')).toBeVisible();
    await expect(page.locator('.species-card')).toHaveCount(6);
    await page.getByRole('button', { name: 'Close field guide' }).tap();
    await expect(page.locator('#paused-overlay')).toBeHidden();
    await page.locator('#pond').tap();
    await page.getByRole('button', { name: 'Throw pellets' }).tap();
    await expect(page.locator('#food-count')).toHaveText('18');
    expect(await page.evaluate(() => {
      const scene = (window as InspectedWindow).inspectedPond;
      const rig = scene.children.getByName('throwing-hand') as Phaser.GameObjects.Container;
      const image = rig.getByName('hand-art') as Phaser.GameObjects.Image;
      const transform = image.getWorldTransformMatrix();
      const left = transform.transformPoint(-image.displayOriginX, image.height - image.displayOriginY);
      const right = transform.transformPoint(image.width - image.displayOriginX, image.height - image.displayOriginY);
      return Math.min(left.y, right.y) > scene.game.canvas.height;
    })).toBe(true);
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
