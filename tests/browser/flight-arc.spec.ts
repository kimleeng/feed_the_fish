import { test, expect } from '@playwright/test';
import type Phaser from 'phaser';
import type { PondScene } from '../../src/game.ts';
import type { PondSimulation } from '../../src/simulation.ts';

type InspectedWindow = Window & { inspectedPond: PondScene };

test('rendered flight rises and descends in one continuous arc', async ({ page }, testInfo) => {
  await page.addInitScript(() => document.addEventListener('pond:ready', event => {
    (window as InspectedWindow).inspectedPond = (event as CustomEvent<PondScene>).detail;
  }));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  const result = await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    const Simulation = scene.world.constructor as new (seed: number, throwRoll?: () => number, behaviorRoll?: () => number) => PondSimulation;
    scene.world = new Simulation(41, undefined, () => 0);
    const world = scene.world;
    world.wind.sampleAt = time => ({ time, direction: 0, strength: 0, x: 0, y: 0 });
    for (const animal of world.animals) animal.chewLeft = 100;
    const bird = world.animals.find(animal => animal.profile.id === 'gull')!;
    Object.assign(bird, { x: 350, y: 389, heading: 0, phase: 0, chewLeft: 0 });
    world.animals = [bird];
    scene.update(0, 0);
    const sprite = scene.children.getByName('animal-' + bird.id) as Phaser.GameObjects.Sprite;
    const samples = [{ x: sprite.x, y: sprite.y, altitude: bird.altitude, atlas: sprite.texture.key }];
    world.food = [{ id: 0, throwId: 0, x: 600, y: 695, origin: { x: 600, y: 695 }, target: { x: 750, y: 389 },
      launchHeight: 0, amount: 1, age: 0, phase: 'air', flightTime: 0, flightDuration: 10, height: 0,
      releaseAt: 0, arcScale: 1, lucky: false, bonusClaimed: false }];
    world.step(0.001);
    const flight = bird.flight!;
    let apex = { ...bird, flight: { ...flight } };
    for (let section = 1; section <= 8; section++) {
      const time = flight.duration * section / 8;
      while (flight.elapsed < time - 1e-10) world.step(Math.min(0.05, time - flight.elapsed));
      scene.update(0, 0);
      samples.push({ x: sprite.x, y: sprite.y, altitude: bird.altitude, atlas: sprite.texture.key });
      if (section === 4) apex = { ...bird, flight: { ...flight } };
    }
    // Keep the bird at the apex and trace its sampled screen positions for visual QA.
    Object.assign(bird, apex); world.paused = true; scene.update(1000, 0);
    const trace = scene.add.graphics().setDepth(45.5);
    trace.lineStyle(1.2, 0xfff1b5, 0.85).strokePoints(samples);
    for (const point of samples) trace.fillStyle(0xfff1b5, 0.9).fillCircle(point.x, point.y, 2);
    return { samples, height: bird.profile.flight!.height };
  });
  const { samples, height } = result;
  for (let section = 1; section <= 8; section++) {
    expect(samples[section].x - samples[section - 1].x).toBeCloseTo(50, 5);
    if (section <= 4) expect(samples[section].y).toBeLessThan(samples[section - 1].y);
    else expect(samples[section].y).toBeGreaterThan(samples[section - 1].y);
  }
  expect(samples[0].y - samples[4].y).toBeCloseTo(height, 5);
  for (let section = 1; section < 8; section++) {
    expect(samples[section].atlas).toBe('bird-flyers');
    expect(samples[section].y).toBeCloseTo(samples[8 - section].y, 5);
  }
  expect(samples[8].altitude).toBe(0);
  expect(samples[8].atlas).toBe('bird-swimmers');
  await page.screenshot({ path: testInfo.outputPath('parabolic-bird-flight.png'), fullPage: true });
});
