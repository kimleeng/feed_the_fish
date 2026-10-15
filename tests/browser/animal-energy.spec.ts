import { test, expect, type Page } from '@playwright/test';
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
  await expect(page.locator('#machine-dialog')).toBeHidden();
}

test('one handful can send a bird flying while another bird paddles with its boost', async ({ page }, testInfo) => {
  await arrive(page);
  const result = await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    const Simulation = scene.world.constructor as new (seed: number, throwRoll?: () => number, behaviorRoll?: () => number) => PondSimulation;
    let rolls = 0;
    scene.world = new Simulation(41, undefined, () => ++rolls % 2 ? 0.25 : 0.75);
    const world = scene.world;
    world.wind.sampleAt = time => ({ time, direction: 0, strength: 0, x: 0, y: 0 });
    for (const animal of world.animals) animal.chewLeft = 100;
    const birds = world.animals.filter(animal => animal.profile.id === 'gull').slice(0, 2);
    birds.forEach((bird, index) => Object.assign(bird, { x: 400, y: 340 + index * 100, heading: 0, chewLeft: 0 }));
    world.food = [0, 1, 2, 3].map(id => ({ id, throwId: 1, x: 600, y: 695,
      origin: { x: 600, y: 695 }, target: { x: 600 + id * 4, y: 389 }, amount: 1, age: 0,
      phase: 'air', launchHeight: 0, flightTime: 0, flightDuration: 4, height: 0,
      releaseAt: 0, arcScale: 1, lucky: false, bonusClaimed: false }));
    for (let i = 0; i < 7; i++) world.step(0.05);
    world.paused = true; scene.update(1000, 0);
    return { rolls, birds: birds.map(bird => ({ state: bird.state, boosting: bird.boosting,
      charge: bird.boostCharge, choices: bird.flightChoices,
      atlas: (scene.children.getByName('animal-' + bird.id) as Phaser.GameObjects.Sprite).texture.key })) };
  });
  expect(result.rolls).toBe(2);
  expect(result.birds[0]).toMatchObject({ state: 'flying', boosting: false, charge: 1, choices: { 1: true }, atlas: 'bird-flyers' });
  expect(result.birds[1]).toMatchObject({ state: 'approaching', boosting: true, choices: { 1: false }, atlas: 'bird-swimmers' });
  expect(result.birds[1].charge).toBeCloseTo(0.825);
  await page.screenshot({ path: testInfo.outputPath('mixed-flight-and-paddle.png'), fullPage: true });
});

for (const viewport of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
  test(`boost meters show chase energy at ${viewport.width}px and a new visit resets feeding history`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await arrive(page);
    const result = await page.evaluate(() => {
      const scene = (window as InspectedWindow).inspectedPond;
      const Simulation = scene.world.constructor as new (seed: number) => PondSimulation;
      scene.world = new Simulation(41);
      const world = scene.world;
      const fish = world.animals.filter(animal => animal.profile.id === 'carp').slice(0, 2);
      const duck = world.animals.find(animal => animal.profile.id === 'duck')!;
      const selected = [...fish, duck];
      const fishLayer = scene.children.getByName('fish-layer') as Phaser.GameObjects.Container;
      for (const animal of world.animals) {
        const sprite = (animal.profile.kind === 'bird' ? scene.children : fishLayer).getByName('animal-' + animal.id) as Phaser.GameObjects.Sprite;
        sprite.setVisible(selected.includes(animal));
        if (animal.profile.kind === 'turtle') (scene.children.getByName('turtle-head-' + animal.id) as Phaser.GameObjects.Sprite).setVisible(false);
      }
      world.animals = selected;
      selected.forEach((animal, index) => Object.assign(animal, { x: 480, y: 290 + index * 100, heading: 0 }));
      fish[1].lastAteAt = 0; fish[1].totalEaten = 0.65; fish[1].boostCharge = 0.2;
      world.food = selected.map((animal, id) => ({ id, throwId: id, x: 620, y: animal.y,
        origin: { x: 620, y: animal.y }, target: { x: 620, y: animal.y }, amount: 1, age: 0,
        phase: 'water', launchHeight: 0, flightTime: 1, flightDuration: 1, height: 0,
        releaseAt: 0, arcScale: 1, lucky: false, bonusClaimed: false }));
      scene.update(0, 100); world.paused = true; scene.update(1000, 0);
      return selected.map(animal => ({ id: animal.id, speed: animal.profile.speed, boosting: animal.boosting,
        charge: animal.boostCharge, lastAteAt: animal.lastAteAt, traveled: Math.hypot(animal.x - 480, animal.y - (290 + selected.indexOf(animal) * 100)) }));
    });
    expect(result[0].boosting).toBe(true);
    expect(result[0].charge).toBeCloseTo(0.95);
    expect(result[0].lastAteAt).toBeNull();
    expect(result[0].traveled).toBeCloseTo(result[0].speed * 1.4 * 0.1);
    expect(result[1].boosting).toBe(false);
    expect(result[1].charge).toBeCloseTo(0.2 + 0.1 / 30);
    expect(result[1].lastAteAt).toBe(0);
    expect(result[1].traveled).toBeCloseTo(result[1].speed * 0.1);
    expect(result[2].boosting).toBe(true);

    const visibility = await page.evaluate(async ids => {
      const scene = (window as InspectedWindow).inspectedPond;
      const meters = scene.children.getByName('animal-boost-meters') as Phaser.GameObjects.Graphics;
      const canvas = scene.game.canvas, display = canvas.getBoundingClientRect();
      const viewport = canvas.parentElement!.getBoundingClientRect();
      const scaled = document.createElement('canvas');
      scaled.width = Math.round(viewport.width); scaled.height = Math.round(viewport.height);
      const context = scaled.getContext('2d')!;
      const snapshot = async () => {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        context.clearRect(0, 0, scaled.width, scaled.height);
        context.drawImage(canvas, display.left - viewport.left, display.top - viewport.top, display.width, display.height);
        return { full: canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data,
          displayed: context.getImageData(0, 0, scaled.width, scaled.height).data };
      };
      meters.setVisible(true); const visible = await snapshot();
      meters.setVisible(false); const hidden = await snapshot();
      meters.setVisible(true);
      const nearAnimal = ids.map(id => {
        const animal = scene.world.animals.find(animal => animal.id === id)!;
        const layer = animal.profile.kind === 'bird' ? scene.children
          : scene.children.getByName('fish-layer') as Phaser.GameObjects.Container;
        const sprite = layer.getByName('animal-' + id) as Phaser.GameObjects.Sprite;
        return { x: animal.x, top: sprite.y + (sprite.frame.y - sprite.displayOriginY) * sprite.scaleY, pixels: 0 };
      });
      let displayedPixels = 0;
      for (let index = 0; index < visible.full.length; index += 4) {
        const difference = Math.abs(visible.full[index] - hidden.full[index]) + Math.abs(visible.full[index + 1] - hidden.full[index + 1])
          + Math.abs(visible.full[index + 2] - hidden.full[index + 2]);
        if (difference < 30) continue;
        const x = index / 4 % canvas.width, y = Math.floor(index / 4 / canvas.width);
        for (const animal of nearAnimal) if (Math.abs(x - animal.x) < 12 && y < animal.top && y > animal.top - 12) animal.pixels++;
      }
      for (let index = 0; index < visible.displayed.length; index += 4) {
        const difference = Math.abs(visible.displayed[index] - hidden.displayed[index])
          + Math.abs(visible.displayed[index + 1] - hidden.displayed[index + 1])
          + Math.abs(visible.displayed[index + 2] - hidden.displayed[index + 2]);
        if (difference > 60) displayedPixels++;
      }
      return { pixels: nearAnimal.map(animal => animal.pixels), displayedPixels,
        charges: scene.world.animals.map(animal => animal.boostCharge) };
    }, result.map(animal => animal.id));
    expect(visibility.pixels.every(pixels => pixels > 30)).toBe(true);
    expect(visibility.displayedPixels).toBeGreaterThan(8);
    expect(visibility.charges).toEqual(result.map(animal => animal.charge));
    await page.screenshot({ path: testInfo.outputPath('animal-boost-meters.png'), fullPage: true });

    const feeding = await page.evaluate(() => {
      const scene = (window as InspectedWindow).inspectedPond, world = scene.world;
      const fish = world.animals[0];
      world.food = [{ ...world.food[0], x: fish.x, y: fish.y, target: { x: fish.x, y: fish.y } }];
      world.paused = false; scene.update(1100, 50); world.paused = true;
      return { lastAteAt: fish.lastAteAt, elapsed: world.elapsed, totalEaten: fish.totalEaten,
        boosting: fish.boosting, state: fish.state };
    });
    expect(feeding).toMatchObject({ lastAteAt: feeding.elapsed, totalEaten: 0.65, boosting: false, state: 'chewing' });
    const reset = await page.evaluate(() => {
      const scene = (window as InspectedWindow).inspectedPond;
      scene.restart();
      return { elapsed: scene.world.elapsed, food: scene.world.food.length,
        fresh: scene.world.animals.every(animal => animal.lastAteAt === null && animal.totalEaten === 0
          && animal.boostCharge === 1 && !animal.boosting && !Object.keys(animal.flightChoices).length) };
    });
    expect(reset).toEqual({ elapsed: 0, food: 0, fresh: true });
  });
}
