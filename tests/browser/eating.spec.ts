import { test, expect, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { PondScene } from '../../src/game.ts';
import type { AnimationFrameData } from '../../src/animation-frames.ts';

type PondWindow = Window & { inspectedPond: PondScene };
async function arrive(page: Page) {
  await page.addInitScript(() => document.addEventListener('pond:ready', event => {
    (window as PondWindow).inspectedPond = (event as CustomEvent<PondScene>).detail;
  }));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
}

test('real meals use distinct eating drawings in every direction, keep anchors, and return to swimming', async ({ page }, testInfo) => {
  await arrive(page);
  const results = await page.evaluate(() => {
    const scene = (window as PondWindow).inspectedPond;
    scene.scene.pause(); scene.world.paused = true;
    const layer = scene.children.getByName('fish-layer') as Phaser.GameObjects.Container;
    const animals = ['koi', 'carp', 'minnow', 'duck', 'gull', 'coot', 'musk-turtle']
      .map(id => scene.world.animals.find(animal => animal.profile.id === id)!);
    const directions = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
    const review = document.createElement('canvas'); review.id = 'eating-review'; review.width = 1440; review.height = 840;
    const ctx = review.getContext('2d')!; ctx.fillStyle = '#dce6d7'; ctx.fillRect(0, 0, review.width, review.height);
    ctx.imageSmoothingEnabled = false; ctx.font = '12px monospace';
    const results = [];
    for (const [row, animal] of animals.entries()) for (const [column, direction] of directions.entries()) {
      Object.assign(animal, { x: 600, y: 389, heading: column * Math.PI / 4, state: 'roaming', chewLeft: 0,
        meal: null, surfaceLeft: 2, moving: false });
      scene.world.animals = [animal]; scene.world.food = [];
      const sprite = animal.profile.kind === 'turtle'
        ? scene.children.getByName('turtle-head-' + animal.id) as Phaser.GameObjects.Sprite
        : (animal.profile.kind === 'bird' ? scene.children : layer).getByName('animal-' + animal.id) as Phaser.GameObjects.Sprite;
      scene.update(0, 0);
      function draw(slot: number) {
        const frame = sprite.frame, scale = sprite.scaleX * 1.7;
        const x = column * 180 + (slot % 2) * 86 + 45, y = row * 120 + Math.floor(slot / 2) * 48 + 35;
        ctx.drawImage(frame.source.image as CanvasImageSource, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
          x + (frame.x - sprite.displayOriginX) * scale, y + (frame.y - sprite.displayOriginY) * scale, frame.cutWidth * scale, frame.cutHeight * scale);
      }
      draw(0);
      scene.world.food = [{ id: 999, throwId: 999, x: 600, y: 389, origin: { x: 600, y: 389 }, target: { x: 600, y: 389 },
        amount: animal.profile.bite, age: 0, phase: 'water', launchHeight: 0, flightTime: 1, flightDuration: 1,
        height: 0, releaseAt: 0, arcScale: 1, lucky: false, bonusClaimed: false }];
      animal.surfaceLeft = 0;
      scene.world.paused = false; scene.world.step(.01); scene.world.paused = true;
      const eaten = scene.world.eatenFood;
      scene.world.bites = [];
      const samples = [];
      for (const progress of [0, .25, .4, .55, .7, .84, .96, 1]) {
        animal.chewLeft = animal.meal!.duration * (1 - progress);
        animal.surfaceLeft = animal.surfaceDuration - Math.max(.5, animal.meal!.duration * progress);
        scene.update(0, 0);
        const data = sprite.frame.customData as AnimationFrameData;
        const anchorError = data.waterline ? Math.abs((data.waterline.y - sprite.displayOriginY) * sprite.scaleY - animal.profile.size * .2)
          : data.surfaceOffset ? Math.hypot(
            (sprite.frame.x + sprite.frame.cutWidth / 2 - sprite.displayOriginX) * sprite.scaleX - data.surfaceOffset.x * animal.profile.size,
            (sprite.frame.y + sprite.frame.cutHeight / 2 - sprite.displayOriginY) * sprite.scaleY - data.surfaceOffset.y * animal.profile.size) : 0;
        samples.push({ progress, frame: sprite.frame.name, atlas: sprite.texture.key,
          exists: sprite.texture.has(sprite.frame.name), scale: sprite.scaleX, uniform: sprite.scaleX === sprite.scaleY, anchorError });
        if (progress === 0) draw(1); if (progress === .25) draw(2); if (progress === .84) draw(3);
      }
      ctx.fillStyle = '#334d3b'; ctx.fillText(`${animal.profile.id} ${direction}`, column * 180 + 4, row * 120 + 114);
      results.push({ species: animal.profile.id, kind: animal.profile.kind, direction, samples, eatenUnchanged: eaten === scene.world.eatenFood });
    }
    document.body.append(review);
    return results;
  });
  expect(results).toHaveLength(56);
  for (const animal of results) {
    expect(animal.eatenUnchanged).toBe(true);
    const feeding = animal.samples.filter(sample => sample.atlas === 'animal-eating');
    expect(new Set(feeding.map(sample => sample.frame)).size).toBe(animal.kind === 'fish' ? 2 : 3);
    expect(new Set(feeding.map(sample => sample.scale)).size).toBe(1);
    expect(animal.samples.every(sample => sample.exists && sample.uniform && sample.anchorError < .2)).toBe(true);
    expect(animal.samples[0].frame).toBe(`${animal.species}-${animal.direction}-bite`);
    expect(animal.samples.at(-1)!.atlas).toBe(animal.kind === 'fish' ? 'fish-swimmers' : animal.kind === 'bird' ? 'bird-swimmers' : 'turtle-swimmer');
  }
  await page.locator('#eating-review').screenshot({ path: testInfo.outputPath('all-eating-directions.png') });
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`feeding is visible at ${viewport.width}px, freezes with the pond, and survives reduced motion`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await arrive(page);
    const prepare = async () => page.evaluate(() => {
      const scene = (window as PondWindow).inspectedPond;
      scene.scene.pause(); scene.world.paused = false;
      const selected = ['koi', 'carp', 'minnow', 'duck', 'gull', 'coot', 'musk-turtle']
        .map(id => scene.world.animals.find(animal => animal.profile.id === id)!);
      const layer = scene.children.getByName('fish-layer') as Phaser.GameObjects.Container;
      for (const animal of scene.world.animals) {
        const sprite = (animal.profile.kind === 'bird' ? scene.children : layer).getByName('animal-' + animal.id) as Phaser.GameObjects.Sprite;
        sprite.setVisible(selected.includes(animal));
      }
      scene.world.animals = selected;
      selected.forEach((animal, index) => Object.assign(animal, { x: 510 + index % 3 * 90, y: 320 + Math.floor(index / 3) * 80,
        heading: Math.PI / 2, chewLeft: 0, meal: null, state: 'roaming' }));
      scene.world.food = selected.map((animal, id) => ({ id: 500 + id, throwId: 500 + id, x: animal.x, y: animal.y,
        origin: { x: animal.x, y: animal.y }, target: { x: animal.x, y: animal.y }, amount: animal.profile.bite,
        age: 0, phase: 'water', launchHeight: 0, flightTime: 1, flightDuration: 1, height: 0, releaseAt: 0, arcScale: 1,
        lucky: false, bonusClaimed: false }));
      scene.update(0, 10);
      scene.world.paused = true;
      selected.forEach(animal => { animal.surfaceLeft = animal.surfaceDuration - .5; animal.chewLeft *= .67; });
      scene.update(1000, 0);
      return selected.map(animal => ({ id: animal.id, meal: animal.meal, left: animal.chewLeft }));
    });
    const initial = await prepare();
    expect(initial.every(animal => animal.meal && animal.left > 0)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`feeding-${viewport.width}.png`), fullPage: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const after = await page.evaluate(() => {
      const scene = (window as PondWindow).inspectedPond;
      for (let i = 0; i < 120; i++) scene.update(i * 50, 50);
      return scene.world.animals.map(animal => ({ id: animal.id, meal: animal.meal, left: animal.chewLeft }));
    });
    expect(after).toEqual(initial);
    await prepare();
    const finished = await page.evaluate(() => {
      const scene = (window as PondWindow).inspectedPond;
      scene.world.paused = false;
      for (let i = 0; i < 140; i++) scene.update(i * 50, 50);
      return scene.world.animals.every(animal => !animal.meal && animal.chewLeft === 0);
    });
    expect(finished).toBe(true);
  });
}

test('feeding carp pitch up with only their lips above reflections in every direction and submerge after eating', async ({ page }, testInfo) => {
  await arrive(page);
  const results = await page.evaluate(async () => {
    const scene = (window as PondWindow).inspectedPond;
    scene.scene.pause(); scene.world.paused = true;
    const water = scene.children.getByName('water-surface') as Phaser.GameObjects.Container;
    const layer = scene.children.getByName('fish-layer') as Phaser.GameObjects.Container;
    const mouths = scene.children.getByName('fish-mouths') as Phaser.GameObjects.Container;
    const fish = ['koi', 'carp', 'minnow'].map(id => scene.world.animals.find(animal => animal.profile.id === id)!);
    const directions = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
    for (const child of layer.list) (child as Phaser.GameObjects.Sprite).setVisible(false);
    for (const child of scene.children.list) if (child.name.startsWith('animal-')) (child as Phaser.GameObjects.Sprite).setVisible(false);
    const sheet = document.createElement('canvas'); sheet.id = 'surface-feeding-review'; sheet.width = 1280; sheet.height = 540;
    const ctx = sheet.getContext('2d')!; ctx.fillStyle = '#e6ecdf'; ctx.fillRect(0, 0, sheet.width, sheet.height);
    ctx.font = '12px monospace'; ctx.imageSmoothingEnabled = false;
    const snapshot = async () => {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      return scene.game.canvas.getContext('2d')!.getImageData(560, 349, 80, 80);
    };
    const results = [];
    for (const [row, animal] of fish.entries()) for (const [column, direction] of directions.entries()) {
      scene.world.animals = [animal];
      Object.assign(animal, { x: 600, y: 389, heading: column * Math.PI / 4, state: 'roaming', meal: null, chewLeft: 0 });
      const base = layer.getByName('animal-' + animal.id) as Phaser.GameObjects.Sprite;
      const body = layer.getByName('feeding-fish-' + animal.id) as Phaser.GameObjects.Sprite;
      const mouth = mouths.getByName('fish-mouth-' + animal.id) as Phaser.GameObjects.Sprite;
      base.setVisible(true);
      scene.world.food = [{ id: 998, throwId: 998, x: 600, y: 389, origin: { x: 600, y: 389 }, target: { x: 600, y: 389 },
        amount: animal.profile.bite, age: 0, phase: 'water', launchHeight: 0, flightTime: 1, flightDuration: 1,
        height: 0, releaseAt: 0, arcScale: 1, lucky: false, bonusClaimed: false }];
      scene.world.paused = false; scene.world.step(.01); scene.world.paused = true; scene.world.bites = [];
      const duration = animal.meal!.duration;
      const poses = [];
      for (const [index, elapsed] of (row === 0 ? [.76, .34] : row === 1 ? [.584, .296] : [.322, .178]).entries()) {
        animal.chewLeft = duration - elapsed; scene.update(0, 0);
        const pixels = await snapshot();
        const tile = document.createElement('canvas'); tile.width = 80; tile.height = 80; tile.getContext('2d')!.putImageData(pixels, 0, 0);
        ctx.drawImage(tile, column * 160 + index * 80, row * 180 + 20, 80, 80);
        const lip = (mouth.frame.customData as AnimationFrameData).surfaceMouth!;
        poses.push({ frame: body.frame.name, mouthFrame: mouth.frame.name, cropped: mouth.isCropped, visible: mouth.visible,
          bodyBelow: body.parentContainer!.depth < water.depth, mouthAbove: mouths.depth > water.depth,
          aligned: body.x === mouth.x && body.y === mouth.y && body.scaleX === mouth.scaleX,
          lipFraction: lip.h / mouth.frame.realHeight, alpha: mouth.alpha, baseAlpha: base.alpha });
        if (index === 0) {
          mouth.setVisible(false);
          const submerged = await snapshot(); mouth.setVisible(true);
          let revealed = 0;
          for (let i = 0; i < pixels.data.length; i += 4) {
            if (Math.abs(pixels.data[i] - submerged.data[i]) + Math.abs(pixels.data[i + 1] - submerged.data[i + 1]) + Math.abs(pixels.data[i + 2] - submerged.data[i + 2]) > 15) revealed++;
          }
          results.push({ species: animal.profile.id, direction, revealed, poses });
        }
      }
      ctx.fillStyle = '#334d3b'; ctx.fillText(`${animal.profile.id} ${direction}`, column * 160 + 5, row * 180 + 120);
      animal.chewLeft = .01;
      scene.world.paused = false; scene.update(0, 20); scene.world.paused = true;
      if (mouth.visible || body.visible || base.alpha < .8) throw new Error('Carp did not return beneath the surface');
      base.setVisible(false);
    }
    scene.restart();
    if (mouths.list.length !== 46 || mouths.list.some(child => (child as Phaser.GameObjects.Sprite).visible)) throw new Error('New visit leaked surface mouths');
    document.body.append(sheet);
    return results;
  });
  for (const fish of results) {
    expect(fish.revealed, `${fish.species} ${fish.direction}: the lips visibly break the reflections`).toBeGreaterThan(2);
    expect(fish.poses.map(pose => pose.frame)).toEqual([`${fish.species}-${fish.direction}-surface-bite`, `${fish.species}-${fish.direction}-surface-chew`]);
    expect(fish.poses.every(pose => pose.aligned && pose.cropped && pose.visible && pose.bodyBelow && pose.mouthAbove &&
      pose.frame === pose.mouthFrame && pose.lipFraction < .25 && pose.alpha > .99 && pose.baseAlpha < .01)).toBe(true);
  }
  await page.locator('#surface-feeding-review').screenshot({ path: testInfo.outputPath('surfaced-carp-directions.png') });
});
