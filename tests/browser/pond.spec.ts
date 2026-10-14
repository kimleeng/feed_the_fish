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

async function gardenMachinePoint(page: Page): Promise<{ x: number; y: number }> {
  const point = await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    const machine = scene.children.getByName('garden-pellet-machine') as Phaser.GameObjects.Container;
    const art = machine.getByName('machine-art') as Phaser.GameObjects.Image;
    return { x: machine.x, y: machine.y - art.displayHeight * 0.65 };
  });
  const bounds = (await page.locator('#pond canvas').boundingBox())!;
  return { x: bounds.x + point.x / 1200 * bounds.width, y: bounds.y + point.y / 800 * bounds.height };
}

test('kids and adults visibly walk, face the pond while watching, and freeze and reset with the visit', async ({ page }, testInfo) => {
  await arrive(page);
  await page.locator('#machine-watch').click();
  const initial = await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    // Pause automatic updates while leaving the renderer running for pixel checks.
    scene.scene.pause();
    const Simulation = scene.world.constructor as new (seed: number) => PondSimulation;
    scene.world = new Simulation(11);
    scene.update(0, 0);
    return scene.world.crowd.people.map(person => {
      const visitor = scene.children.getByName('observer-' + person.id) as Phaser.GameObjects.Container;
      const sprite = visitor.getByName('observer-art') as Phaser.GameObjects.Sprite;
      return { id: person.id, age: person.age, state: person.state, direction: person.direction,
        x: person.x, y: person.y, remaining: person.watchRemaining, frame: sprite.frame.name,
        atlas: sprite.texture.key, flipped: sprite.flipX, interactive: !!sprite.input,
        height: sprite.frame.cutHeight * sprite.scaleY };
    });
  });
  expect(initial).toHaveLength(4);
  expect(new Set(initial.map(person => person.age))).toEqual(new Set(['adult', 'kid']));
  expect(initial.some(person => person.state === 'watching')).toBe(true);
  expect(initial.some(person => person.state !== 'watching')).toBe(true);
  for (const person of initial) {
    expect(person.atlas).toBe('garden-observers');
    expect(person.interactive).toBe(false);
    expect(person.frame).toContain('observer-' + person.age);
    expect(person.height).toBeGreaterThan(person.age === 'adult' ? 130 : 80);
    expect(person.height).toBeLessThan(person.age === 'adult' ? 180 : 130);
    expect(person.flipped).toBe(person.state !== 'watching' && person.direction === -1);
    if (person.state === 'watching') expect(person.frame).toMatch(/-watch$/);
  }

  const paintedPixels = await page.evaluate(async () => {
    const scene = (window as InspectedWindow).inspectedPond;
    const visitors = scene.world.crowd.people.map(person =>
      scene.children.getByName('observer-' + person.id) as Phaser.GameObjects.Container);
    const snapshot = async () => {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const canvas = scene.game.canvas;
      return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const withVisitors = await snapshot();
    for (const visitor of visitors) visitor.setVisible(false);
    const withoutVisitors = await snapshot();
    for (const visitor of visitors) visitor.setVisible(true);
    let count = 0;
    for (let i = 0; i < withVisitors.length; i += 4) {
      if (Math.abs(withVisitors[i] - withoutVisitors[i]) + Math.abs(withVisitors[i + 1] - withoutVisitors[i + 1]) +
        Math.abs(withVisitors[i + 2] - withoutVisitors[i + 2]) > 30) count++;
    }
    return count;
  });
  expect(paintedPixels).toBeGreaterThan(800);
  await page.screenshot({ path: testInfo.outputPath('garden-visitors.png'), fullPage: true });

  const moved = await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    const poses = new Map<number, Set<string>>();
    for (let i = 0; i < 10; i++) {
      scene.update(i * 100, 100);
      for (const person of scene.world.crowd.people) {
        const visitor = scene.children.getByName('observer-' + person.id) as Phaser.GameObjects.Container;
        const sprite = visitor.getByName('observer-art') as Phaser.GameObjects.Sprite;
        if (!poses.has(person.id)) poses.set(person.id, new Set());
        poses.get(person.id)!.add(sprite.frame.name);
      }
    }
    return scene.world.crowd.people.map(person => {
      const visitor = scene.children.getByName('observer-' + person.id) as Phaser.GameObjects.Container;
      const sprite = visitor.getByName('observer-art') as Phaser.GameObjects.Sprite;
      return { id: person.id, x: person.x, y: person.y, remaining: person.watchRemaining, frame: sprite.frame.name,
        poses: [...poses.get(person.id)!] };
    });
  });
  for (const person of initial) {
    const after = moved.find(other => other.id === person.id)!;
    if (person.state === 'watching') {
      expect(after.x).toBe(person.x); expect(after.y).toBe(person.y);
      expect(after.remaining).toBeLessThan(person.remaining);
    } else {
      expect(Math.abs(after.x - person.x)).toBeGreaterThan(10);
      expect(new Set([person.frame, ...after.poses]).size).toBeGreaterThan(1);
    }
  }
  await page.getByRole('button', { name: 'Pause game' }).click();
  const frozen = await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    const before = JSON.stringify(scene.world.crowd);
    for (let i = 0; i < 20; i++) scene.update(i * 100, 100);
    return JSON.stringify(scene.world.crowd) === before;
  });
  expect(frozen).toBe(true);
  await page.getByRole('button', { name: 'Back to the pond' }).click();
  const afterDepartures = await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    for (let i = 0; i < 2000; i++) scene.world.step(0.1);
    scene.update(0, 0);
    return { people: scene.world.crowd.people.map(person => 'observer-' + person.id).sort(),
      rendered: scene.children.list.filter(child => child.name.startsWith('observer-')).map(child => child.name).sort() };
  });
  expect(afterDepartures.rendered).toEqual(afterDepartures.people);
  expect(afterDepartures.people.every(name => !initial.some(person => name === 'observer-' + person.id))).toBe(true);
  await page.getByRole('button', { name: 'Begin a new visit' }).click();
  const restarted = await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    scene.scene.resume();
    return { count: scene.world.crowd.people.length, rendered: scene.children.list.filter(child => child.name.startsWith('observer-')).length };
  });
  expect(restarted.count).toBeGreaterThanOrEqual(2);
  expect(restarted.count).toBeLessThanOrEqual(4);
  expect(restarted.rendered).toBe(restarted.count);
  await expect(page.locator('#machine-dialog')).toBeVisible();
});

test('the machine on the garden path opens its coin ritual without throwing food', async ({ page }, testInfo) => {
  await arrive(page);
  await buy(page);
  const point = await gardenMachinePoint(page);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('#machine-dialog')).toBeVisible();
  await expect(page.locator('#food-count')).toHaveText('10');
  expect(await page.evaluate(() => (window as InspectedWindow).inspectedPond.world.pendingThrows)).toBe(0);
  await expect(page.getByRole('button', { name: 'Insert 5 kr coin' })).toBeFocused();
  await buy(page);
  await expect(page.locator('#food-count')).toHaveText('20');
  await expect(page.locator('#money-used')).toHaveText('10 kr');
  await page.screenshot({ path: testInfo.outputPath('tivoli-garden-machine.png'), fullPage: true });
});

test('purchases lower the visible pellet level and an employee walks in to refill below five', async ({ page }, testInfo) => {
  await arrive(page);
  await expect(page.locator('.machine-stock')).toHaveCount(0);
  await expect(page.locator('#machine-fill')).toHaveAttribute('data-level', '25');
  await buy(page);
  await expect(page.locator('#food-count')).toHaveText('10');
  await expect(page.locator('#machine-fill')).toHaveAttribute('data-level', '24');

  const low = await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    scene.scene.pause();
    let time = 100_000;
    for (let purchase = 0; purchase < 19; purchase++) {
      if (!scene.buyPellets()) throw new Error('An available serving was refused');
      for (let tick = 0; tick < 60; tick++) scene.update(time += 50, 50);
    }
    const before = { stock: scene.world.machine.stock, employee: scene.world.employee.phase };
    scene.buyPellets();
    for (let tick = 0; tick < 60; tick++) scene.update(time += 50, 50);
    const visitor = scene.children.getByName('machine-employee') as Phaser.GameObjects.Container;
    const art = visitor.getByName('employee-art') as Phaser.GameObjects.Sprite;
    return { before, stock: scene.world.machine.stock, employee: scene.world.employee.phase,
      visible: visitor.visible, atlas: art.texture.key, frame: art.frame.name,
      money: scene.world.machine.moneyUsed, throws: scene.world.handfuls };
  });
  expect(low.before).toEqual({ stock: 5, employee: 'away' });
  expect(low.stock).toBe(4);
  expect(low.employee).toBe('arriving');
  expect(low.visible).toBe(true);
  expect(low.atlas).toBe('garden-employee');
  expect(low.frame).toMatch(/^walk-[0-3](-between)?$/);
  expect(low.money).toBe(105); expect(low.throws).toBe(210);

  const pouring = await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    let time = 200_000;
    for (let tick = 0; tick < 400 && scene.world.employee.phase !== 'pouring'; tick++) scene.update(time += 50, 50);
    for (let tick = 0; tick < 24; tick++) scene.update(time += 50, 50);
    const visitor = scene.children.getByName('machine-employee') as Phaser.GameObjects.Container;
    const art = visitor.getByName('employee-art') as Phaser.GameObjects.Sprite;
    const machine = scene.children.getByName('garden-pellet-machine') as Phaser.GameObjects.Container;
    const lid = machine.getByName('machine-lid') as Phaser.GameObjects.Image;
    return { phase: scene.world.employee.phase, frame: art.frame.name, stock: scene.world.machine.stock,
      fill: scene.world.machine.fillFraction, restocking: scene.world.machine.restocking,
      x: visitor.x, y: visitor.y, lidRotation: lid.rotation, canBuy: scene.buyPellets() };
  });
  expect(pouring.phase).toBe('pouring');
  expect(pouring.frame).toMatch(/^pour(-rock)?$/);
  expect(pouring.stock).toBe(4);
  expect(pouring.fill).toBeGreaterThan(0.4); expect(pouring.fill).toBeLessThan(0.8);
  expect(pouring.restocking).toBe(true); expect(pouring.canBuy).toBe(false);
  expect(pouring.x).toBeGreaterThan(300); expect(pouring.x).toBeLessThan(400);
  expect(pouring.y).toBeGreaterThan(700); expect(pouring.y).toBeLessThan(760);
  expect(pouring.lidRotation).toBeCloseTo(-Math.PI / 2);
  await page.screenshot({ path: testInfo.outputPath('employee-refilling.png'), fullPage: true });
  await page.getByRole('button', { name: 'Pellet machine' }).click();
  await expect(page.getByRole('button', { name: 'Insert 5 kr coin' })).toBeDisabled();
  await expect(page.locator('#close-machine')).toBeEnabled();
  await expect(page.locator('#machine-status')).toContainText('topping up');
  await page.screenshot({ path: testInfo.outputPath('machine-half-refilled.png'), fullPage: true });
  const frozen = await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    scene.world.paused = true;
    const before = JSON.stringify([scene.world.employee, scene.world.machine]);
    for (let tick = 0; tick < 100; tick++) scene.update(300_000 + tick * 50, 50);
    return before === JSON.stringify([scene.world.employee, scene.world.machine]);
  });
  expect(frozen).toBe(true);
  const finished = await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    scene.world.paused = false;
    for (let tick = 0; tick < 300; tick++) scene.update(400_000 + tick * 50, 50);
    const visitor = scene.children.getByName('machine-employee') as Phaser.GameObjects.Container;
    return { stock: scene.world.machine.stock, fill: scene.world.machine.fillFraction,
      restocks: scene.world.machine.restocks, employee: scene.world.employee.phase, visible: visitor.visible,
      money: scene.world.machine.moneyUsed, throws: scene.world.handfuls };
  });
  expect(finished).toEqual({ stock: 25, fill: 1, restocks: 1, employee: 'away', visible: false, money: 105, throws: 210 });
  await expect(page.getByRole('button', { name: 'Insert 5 kr coin' })).toBeEnabled();
  await expect(page.locator('#machine-fill')).toHaveAttribute('data-level', '25');
});

test('an empty globe blocks payment until the employee returns stock, and a new visit resets it', async ({ page }, testInfo) => {
  await arrive(page);
  const levels = await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    scene.scene.pause(); scene.world.paused = true;
    const machine = scene.children.getByName('garden-pellet-machine') as Phaser.GameObjects.Container;
    const pile = machine.getByName('machine-pellet-fill') as Phaser.GameObjects.Image;
    const canvas = document.querySelector<HTMLCanvasElement>('#machine-fill')!;
    const snapshot = () => ({ level: Number(canvas.dataset.level), frame: pile.frame.name,
      cropped: pile.isCropped, visible: pile.visible, clip: getComputedStyle(canvas).clipPath, pixels: canvas.toDataURL() });
    const levels = [snapshot()];
    let time = 100_000;
    for (let purchase = 0; purchase < 25; purchase++) {
      if (!scene.buyPellets()) throw new Error('The machine ran out before 25 purchases');
      for (let tick = 0; tick < 60; tick++) scene.update(time += 50, 50);
      levels.push(snapshot());
    }
    return levels;
  });
  expect(new Set(levels.map(level => level.pixels)).size).toBe(26);
  for (const [index, level] of levels.entries()) {
    expect(level.level).toBe(25 - index);
    expect(level.cropped).toBe(false); expect(level.clip).toBe('none');
    expect(level.visible).toBe(index < 25);
    if (index < 25) expect(level.frame).toBe(`stock-${25 - index}`);
  }
  await page.getByRole('button', { name: 'Pellet machine' }).click();
  await expect(page.locator('#machine-fill')).toHaveAttribute('data-level', '0');
  await expect(page.locator('#machine-fill')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Insert 5 kr coin' })).toBeDisabled();
  await expect(page.locator('#machine-status')).toContainText('Resume the pond');
  await expect(page.locator('#money-used')).toHaveText('125 kr');
  await page.screenshot({ path: testInfo.outputPath('machine-empty.png'), fullPage: true });
  const recovered = await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    const rejected = !scene.buyPellets();
    scene.world.paused = false;
    for (let tick = 0; tick < 600; tick++) scene.update(300_000 + tick * 50, 50);
    return { rejected, stock: scene.world.machine.stock, coins: scene.world.machine.coinsUsed,
      throws: scene.world.handfuls, restocks: scene.world.machine.restocks };
  });
  expect(recovered).toEqual({ rejected: true, stock: 25, coins: 25, throws: 250, restocks: 1 });
  const restarted = await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    scene.restart();
    const visitor = scene.children.getByName('machine-employee') as Phaser.GameObjects.Container;
    return { stock: scene.world.machine.stock, coins: scene.world.machine.coinsUsed,
      restocks: scene.world.machine.restocks, visible: visitor.visible };
  });
  expect(restarted).toEqual({ stock: 25, coins: 0, restocks: 0, visible: false });
  await expect(page.locator('#machine-fill')).toHaveAttribute('data-level', '25');
});

test('the secret turtle stays hidden except for its feeding peek, including after a new visit', async ({ page }, testInfo) => {
  await arrive(page);
  await page.locator('#machine-watch').click();
  const before = await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    scene.scene.pause();
    const turtle = scene.world.animals.find(animal => animal.profile.kind === 'turtle')!;
    for (const animal of scene.world.animals) animal.chewLeft = 30;
    Object.assign(turtle, { x: 600, y: 389, heading: 0, chewLeft: 0, surfaceLeft: 0 });
    scene.update(1000, 0);
    const layer = scene.children.getByName('fish-layer') as Phaser.GameObjects.Container;
    const body = layer.getByName('animal-' + turtle.id) as Phaser.GameObjects.Sprite;
    const head = scene.children.getByName('turtle-head-' + turtle.id) as Phaser.GameObjects.Sprite;
    const water = scene.children.getByName('water-surface') as Phaser.GameObjects.Container;
    return { count: scene.world.animals.filter(animal => animal.profile.kind === 'turtle').length,
      bodyVisible: body.visible, headVisible: head.visible, bodyDepth: layer.depth, waterDepth: water.depth,
      atlas: body.texture.key, masked: !!layer.mask };
  });
  expect(before.count).toBe(1);
  expect(before.bodyVisible).toBe(false);
  expect(before.headVisible).toBe(false);
  expect(before.bodyDepth).toBeLessThan(before.waterDepth);
  expect(before.masked).toBe(true);
  expect(before.atlas).toBe('turtle-swimmer');

  const after = await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    const turtle = scene.world.animals.find(animal => animal.profile.kind === 'turtle')!;
    scene.world.handfuls = 1;
    scene.world.scatter({ x: turtle.x, y: turtle.y });
    for (let tick = 0; tick < 160 && scene.world.turtleFood === 0; tick++) scene.update(2000 + tick * 50, 50);
    scene.world.food = [];
    for (let tick = 0; tick < 10; tick++) scene.update(12_000 + tick * 50, 50);
    const head = scene.children.getByName('turtle-head-' + turtle.id) as Phaser.GameObjects.Sprite;
    const layer = scene.children.getByName('fish-layer') as Phaser.GameObjects.Container;
    const body = layer.getByName('animal-' + turtle.id) as Phaser.GameObjects.Sprite;
    const water = scene.children.getByName('water-surface') as Phaser.GameObjects.Container;
    return { eaten: scene.world.turtleFood, bodyVisible: body.visible, bodyAlpha: body.alpha,
      visible: head.visible, alpha: head.alpha, headDepth: head.depth,
      waterDepth: water.depth, frame: head.frame.name, frameExists: head.texture.has(head.frame.name) };
  });
  expect(after.eaten).toBeGreaterThan(0);
  expect(after.bodyVisible).toBe(true);
  expect(after.bodyAlpha).toBeGreaterThan(0);
  expect(after.bodyAlpha).toBeLessThan(1);
  expect(after.visible).toBe(true);
  expect(after.alpha).toBe(1);
  expect(after.headDepth).toBeGreaterThan(after.waterDepth);
  expect(after.frame).toMatch(/^musk-turtle-\w+-head$/);
  expect(after.frameExists).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('turtle-peeking.png'), fullPage: true });

  const pausedPeek = await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    const turtle = scene.world.animals.find(animal => animal.profile.kind === 'turtle')!;
    const head = scene.children.getByName('turtle-head-' + turtle.id) as Phaser.GameObjects.Sprite;
    const layer = scene.children.getByName('fish-layer') as Phaser.GameObjects.Container;
    const body = layer.getByName('animal-' + turtle.id) as Phaser.GameObjects.Sprite;
    scene.world.paused = true;
    const remaining = turtle.surfaceLeft;
    const bodyAlpha = body.alpha;
    const headAlpha = head.alpha;
    for (let tick = 0; tick < 120; tick++) scene.update(14_000 + tick * 50, 50);
    return { bodyVisible: body.visible, headVisible: head.visible,
      frozen: turtle.surfaceLeft === remaining && body.alpha === bodyAlpha && head.alpha === headAlpha };
  });
  expect(pausedPeek).toEqual({ bodyVisible: true, headVisible: true, frozen: true });

  const sinking = await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    scene.world.paused = false;
    for (let tick = 0; tick < 80; tick++) scene.update(21_000 + tick * 50, 50);
    const turtle = scene.world.animals.find(animal => animal.profile.kind === 'turtle')!;
    const head = scene.children.getByName('turtle-head-' + turtle.id) as Phaser.GameObjects.Sprite;
    const layer = scene.children.getByName('fish-layer') as Phaser.GameObjects.Container;
    const body = layer.getByName('animal-' + turtle.id) as Phaser.GameObjects.Sprite;
    return { bodyVisible: body.visible, headVisible: head.visible, bodyAlpha: body.alpha, headAlpha: head.alpha };
  });
  expect(sinking.bodyVisible).toBe(true);
  expect(sinking.headVisible).toBe(true);
  expect(sinking.bodyAlpha).toBeGreaterThan(0);
  expect(sinking.bodyAlpha).toBeLessThan(after.bodyAlpha);
  expect(sinking.headAlpha).toBeGreaterThan(0);
  expect(sinking.headAlpha).toBeLessThan(after.alpha);
  expect(sinking.bodyAlpha / after.bodyAlpha).toBeCloseTo(sinking.headAlpha / after.alpha);

  const submerged = await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    for (let tick = 0; tick < 40; tick++) scene.update(25_000 + tick * 50, 50);
    const turtle = scene.world.animals.find(animal => animal.profile.kind === 'turtle')!;
    const head = scene.children.getByName('turtle-head-' + turtle.id) as Phaser.GameObjects.Sprite;
    const layer = scene.children.getByName('fish-layer') as Phaser.GameObjects.Container;
    const body = layer.getByName('animal-' + turtle.id) as Phaser.GameObjects.Sprite;
    return { body: body.visible, head: head.visible, remaining: turtle.surfaceLeft };
  });
  expect(submerged).toEqual({ body: false, head: false, remaining: 0 });
  const restarted = await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    scene.restart();
    const turtle = scene.world.animals.find(animal => animal.profile.kind === 'turtle')!;
    const layer = scene.children.getByName('fish-layer') as Phaser.GameObjects.Container;
    const body = layer.getByName('animal-' + turtle.id) as Phaser.GameObjects.Sprite;
    const head = scene.children.getByName('turtle-head-' + turtle.id) as Phaser.GameObjects.Sprite;
    return { turtles: scene.world.animals.filter(animal => animal.profile.kind === 'turtle').length,
      heads: scene.children.list.filter(child => child.name.startsWith('turtle-head-')).length,
      food: scene.world.turtleFood, score: scene.world.score, bodyVisible: body.visible, headVisible: head.visible };
  });
  expect(restarted).toEqual({ turtles: 1, heads: 1, food: 0, score: 0, bodyVisible: false, headVisible: false });
});

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
          const sprite = (animal.profile.kind !== 'bird' ? fishLayer.getByName('animal-' + animal.id)
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
      expect(animal.frame).toMatch(new RegExp(`^${animal.species}-${directions[heading]}-[0-3]$`));
      expect(animal.frameExists).toBe(true);
      expect(animal.flipped).toBe(false);
      if (animal.kind !== 'bird') {
        expect(animal.atlas).toBe(animal.kind === 'turtle' ? 'turtle-swimmer' : 'fish-swimmers');
        expect(animal.depth).toBeLessThan(animal.waterDepth);
        if (animal.kind === 'fish') expect(animal.alpha).toBeGreaterThan(0.6);
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
  }, { timeout: 5000 }).toBe(4);
  await page.getByRole('button', { name: 'Field guide' }).click();
  await expect(page.getByRole('heading', { name: 'Little coot' })).toBeVisible();
  expect(await page.locator('.species-art').evaluateAll(images =>
    images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('swimming-field-guide.png'), fullPage: true });
});

test('the dock character keeps planted feet through three throws, releases from the drawn hand, and earns lucky bonuses', async ({ page }, testInfo) => {
  await arrive(page);
  await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    const Simulation = scene.world.constructor as new (seed: number, roll?: () => number) => PondSimulation;
    const rolls = [0.1, 0.5, 0.75, 0.5, 0.95, 0.01, 0.1, 0.5];
    scene.world = new Simulation(1234, () => rolls.shift() ?? 0.5);
    // Keep the lucky pellet available while inspecting all three animations.
    // Feeding resumes below when the test places the intended fish beside it.
    for (const animal of scene.world.animals) { animal.chewLeft = 60; animal.state = 'chewing'; }
  });
  await buy(page);

  for (const animation of ['toss', 'overhand', 'spread']) {
    if (animation === 'spread') {
      await expect.poll(() => page.evaluate(() => {
        const rig = (window as InspectedWindow).inspectedPond.children.getByName('dock-thrower') as Phaser.GameObjects.Container;
        return rig.getByName('lucky-pellet-indicator').visible;
      })).toBe(true);
      await expect(page.locator('#visit-note')).toContainText('golden pellet');
      await page.screenshot({ path: testInfo.outputPath('lucky-pellet-in-hand.png'), fullPage: true });
    }
    await page.getByRole('button', { name: 'Throw pellets' }).click();
    const frames = await page.evaluate(async expected => {
      const scene = (window as InspectedWindow).inspectedPond;
      const rig = scene.children.getByName('dock-thrower') as Phaser.GameObjects.Container;
      const image = rig.getByName('thrower-art') as Phaser.GameObjects.Image;
      const action = scene.world.currentThrow!;
      if (action.animation !== expected) throw new Error('Wrong throw animation');
      const delays = { toss: 0.26, overhand: 0.44, spread: 0.32 };
      const result: { x: number; y: number; top: number; bottom: number; sole: number; frame: string; flipped: boolean;
        hand: { x: number; y: number }; origins: { x: number; y: number }[] }[] = [];
      await new Promise<void>(resolve => {
        const sample = () => {
          if (scene.world.currentThrow?.id !== action.id) { resolve(); return; }
          const transform = image.getWorldTransformMatrix();
          const cut = image.frame;
          const pin = cut.customData.hand;
          const hand = transform.transformPoint(pin.x - image.displayOriginX, pin.y - image.displayOriginY);
          const feet = cut.customData.feet as { x: number; y: number }[];
          const sole = Math.max(...feet.map(foot => transform.transformPoint(foot.x - image.displayOriginX, foot.y - image.displayOriginY).y));
          const bounds = image.getBounds();
          const released = scene.world.food.filter(food => Math.abs(food.releaseAt - action.startedAt - delays[action.animation]) < 0.000001);
          result.push({ x: rig.x, y: rig.y, top: bounds.top, bottom: bounds.bottom, sole, frame: cut.name,
            flipped: image.flipX, hand: { x: hand.x, y: hand.y }, origins: released.map(food => food.origin) });
          requestAnimationFrame(sample);
        };
        sample();
      });
      return result;
    }, animation);
    expect(frames.length).toBeGreaterThan(5);
    for (const frame of frames) {
      expect(frame.x).toBe(600); expect(frame.y).toBe(684);
      expect(frame.top).toBeGreaterThan(400); expect(frame.bottom).toBeLessThan(800);
      expect(frame.sole).toBeCloseTo(684, 3);
      expect(frame.flipped).toBe(false);
    }
    for (const stage of ['windup', 'drive', 'release', 'follow', 'settle', 'return']) expect(frames.some(frame => frame.frame === `${animation}-${stage}`)).toBe(true);
    const release = frames.find(frame => frame.frame === `${animation}-release`)!;
    expect(release.origins).toHaveLength(4);
    for (const origin of release.origins) {
      expect(origin.x).toBeCloseTo(release.hand.x, 3);
      expect(origin.y).toBeCloseTo(release.hand.y, 3);
    }
  }
  await expect(page.locator('#food-count')).toHaveText('7');
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

test('the thrower faces each throw and keeps looking that way afterward, with food leaving either visible hand', async ({ page }, testInfo) => {
  await arrive(page);
  await page.locator('#machine-watch').click();
  const throws = await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    scene.scene.pause(); scene.world.handfuls = 6;
    for (const animal of scene.world.animals) animal.chewLeft = 60;
    const rig = scene.children.getByName('dock-thrower') as Phaser.GameObjects.Container;
    const art = rig.getByName('thrower-art') as Phaser.GameObjects.Image;
    const results = [];
    let time = 0;
    for (const facing of [-1, 1] as const) for (const animation of ['toss', 'overhand', 'spread'] as const) {
      scene.world.nextThrow = { animation, lucky: false };
      scene.scatter({ x: 600 + facing * 220, y: 389 });
      const action = scene.world.currentThrow!;
      const delay = { toss: 0.26, overhand: 0.44, spread: 0.32 }[animation];
      while (scene.world.elapsed - action.startedAt < delay) scene.update(time += 10, 10);
      const pin = art.frame.customData.hand;
      const localX = (pin.x - art.displayOriginX) * (art.flipX ? -1 : 1);
      const hand = art.getWorldTransformMatrix().transformPoint(localX, pin.y - art.displayOriginY);
      const food = scene.world.food.filter(food => Math.abs(food.releaseAt - action.startedAt - delay) < 0.000001);
      const release = { frame: art.frame.name, flipped: art.flipX, hand: { x: hand.x, y: hand.y }, origins: food.map(food => food.origin) };
      for (let tick = 0; tick < 150; tick++) scene.update(time += 20, 20);
      results.push({ facing, animation, release, idleFlipped: art.flipX, active: !!scene.world.currentThrow });
    }
    return results;
  });
  for (const result of throws) {
    expect(result.release.frame).toBe(`${result.animation}-release`);
    expect(result.release.flipped).toBe(result.facing === 1);
    expect(result.idleFlipped).toBe(result.facing === 1);
    expect(result.active).toBe(false);
    expect(result.release.origins).toHaveLength(4);
    for (const origin of result.release.origins) {
      expect(origin.x).toBeCloseTo(result.release.hand.x, 3);
      expect(origin.y).toBeCloseTo(result.release.hand.y, 3);
    }
  }
  const canvas = (await page.locator('#pond canvas').boundingBox())!;
  await page.mouse.move(canvas.x + canvas.width * 0.25, canvas.y + canvas.height * 0.4);
  expect(await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    const rig = scene.children.getByName('dock-thrower') as Phaser.GameObjects.Container;
    return { flipped: (rig.getByName('thrower-art') as Phaser.GameObjects.Image).flipX, food: scene.world.handfuls };
  })).toEqual({ flipped: true, food: 0 });
  await page.screenshot({ path: testInfo.outputPath('thrower-looking-right.png'), fullPage: true });
  const reset = await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    scene.restart();
    const rig = scene.children.getByName('dock-thrower') as Phaser.GameObjects.Container;
    return (rig.getByName('thrower-art') as Phaser.GameObjects.Image).flipX;
  });
  expect(reset).toBe(false);
});

test('the opening animates the coin and crank, grants ten throws, and feeds an untimed pond', async ({ page }, testInfo) => {
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
  await expect(page.locator('#food-count')).toHaveText('10');
  await expect(page.locator('#money-used')).toHaveText('5 kr');

  const pond = page.locator('#pond');
  const bounds = await pond.boundingBox();
  await pond.click({ position: { x: bounds!.width / 2, y: bounds!.height / 2 } });
  await pond.press('Space');
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Throw pellets' }).click();
  await expect(page.locator('#food-count')).toHaveText('6');
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
  for (let i = 0; i < 10; i++) await page.getByRole('button', { name: 'Throw pellets' }).click();
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
  await expect(page.locator('#food-count')).toHaveText('10');
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
    await expect(page.locator('#food-count')).toHaveText('10');
    await expect.poll(() => page.evaluate(() => {
      const rig = (window as InspectedWindow).inspectedPond.children.getByName('dock-thrower') as Phaser.GameObjects.Container;
      return rig.getByName('lucky-pellet-indicator').visible;
    })).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('lucky-thrower-mobile.png'), fullPage: true });
    await page.getByRole('button', { name: 'Field guide' }).tap();
    await expect(page.locator('#guide-dialog')).toBeVisible();
    await expect(page.locator('.species-card')).toHaveCount(6);
    await page.getByRole('button', { name: 'Close field guide' }).tap();
    await expect(page.locator('#paused-overlay')).toBeHidden();
    await page.locator('#pond').tap();
    await page.getByRole('button', { name: 'Throw pellets' }).tap();
    await expect(page.locator('#food-count')).toHaveText('8');
    expect(await page.evaluate(() => {
      const scene = (window as InspectedWindow).inspectedPond;
      const rig = scene.children.getByName('dock-thrower') as Phaser.GameObjects.Container;
      const image = rig.getByName('thrower-art') as Phaser.GameObjects.Image;
      const bounds = image.getBounds();
      return rig.x === 600 && rig.y === 684 && bounds.top > 0 && bounds.bottom <= scene.game.canvas.height;
    })).toBe(true);
    const machinePoint = await gardenMachinePoint(page);
    await page.touchscreen.tap(machinePoint.x, machinePoint.y);
    await expect(page.locator('#machine-dialog')).toBeVisible();
    await expect(page.locator('#food-count')).toHaveText('8');
    await page.getByRole('button', { name: 'Close pellet machine' }).tap();
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
    await expect(page.locator('#food-count')).toHaveText('10');
    await expect(page.locator('#money-used')).toHaveText('5 kr');
  });
});
