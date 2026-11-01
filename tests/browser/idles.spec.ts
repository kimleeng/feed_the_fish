import { test, expect, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import type Phaser from 'phaser';
import type { PondScene } from '../../src/game.ts';
import type { AnimationFrameData } from '../../src/animation-frames.ts';
import { IDLE_HABITS, BIRD_IDLE_STRIPS } from '../../src/idles.ts';
import { OBSERVER_DESIGNS } from '../../src/observer-looks.ts';
import { OBSERVER_SIGNATURES } from '../../src/observer-idles.ts';

type InspectedWindow = Window & { inspectedPond: PondScene };
async function arrive(page: Page): Promise<void> {
  await page.addInitScript(() => document.addEventListener('pond:ready', event => {
    (window as InspectedWindow).inspectedPond = (event as CustomEvent<PondScene>).detail;
  }));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  await expect(page.locator('#machine-dialog')).toBeHidden();
  await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    scene.scene.pause(); scene.world.paused = true;
  });
}

test('all animal idles render, bird poses stay registered, and completion restores swimming', async ({ page }, testInfo) => {
  await arrive(page);
  const result = await page.evaluate(({ habits, strips }) => {
    const scene = (window as InspectedWindow).inspectedPond;
    const layer = scene.children.getByName('fish-layer') as Phaser.GameObjects.Container;
    const samples = [];
    for (const [species, actions] of Object.entries(habits)) {
      const animal = scene.world.animals.find(a => a.profile.id === species)!;
      const sprite = (animal.profile.kind === 'bird' ? scene.children : layer).getByName('animal-' + animal.id) as Phaser.GameObjects.Sprite;
      for (const habit of actions) {
        Object.assign(animal, { idle: { habit, duration: 3, elapsed: 0, heading: Math.PI }, heading: Math.PI,
          flight: null, altitude: 0, meal: null, chewLeft: 0, surfaceLeft: 0, moving: false, state: 'idle' });
        const frames = [], scales = [], waterErrors = [];
        for (const progress of [.2, .4, .8, .95]) {
          animal.idle!.elapsed = 3 * progress;
          scene.update(0, 0);
          const data = sprite.frame.customData as AnimationFrameData;
          frames.push(sprite.frame.name); scales.push(sprite.scaleX);
          if (data.waterline) waterErrors.push(Math.abs((data.waterline.y - sprite.displayOriginY) * sprite.scaleY - animal.profile.size * .2));
          if (!sprite.texture.has(sprite.frame.name) || !Number.isFinite(sprite.scaleY)) throw new Error('Missing idle frame');
        }
        const strip = strips.includes(habit as typeof strips[number]);
        const mirrored = sprite.flipX;
        animal.idle = null; animal.state = 'roaming'; scene.update(0, 0);
        samples.push({ habit, strip, frames, scales, waterErrors, mirrored, restored: sprite.texture.key,
          reset: !sprite.flipX && sprite.rotation === 0 && sprite.scaleX === sprite.scaleY });
      }
    }
    return samples;
  }, { habits: IDLE_HABITS, strips: BIRD_IDLE_STRIPS });
  expect(new Set(result.map(s => s.habit)).size).toBe(18);
  for (const sample of result) {
    expect(sample.reset).toBe(true);
    expect(['fish-swimmers', 'bird-swimmers']).toContain(sample.restored);
    if (sample.strip) {
      expect(sample.frames).toEqual([1, 2, 3, 0].map(i => `${sample.habit}-${i}`));
      expect(new Set(sample.scales).size).toBe(1);
      expect(sample.mirrored).toBe(true);
      for (const error of sample.waterErrors) expect(error).toBeLessThan(.2);
    }
  }
  await page.screenshot({ path: testInfo.outputPath('idles-return-to-swimming.png'), fullPage: true });
});

test('all twelve visitors keep their outfit, height, planted feet and walking cycles through gestures', async ({ page }, testInfo) => {
  await arrive(page);
  const results = await page.evaluate(({ designs, signatures }) => {
    const scene = (window as InspectedWindow).inspectedPond;
    const model = scene.world.crowd.people[0];
    scene.world.crowd.people = designs.map((design, index) => ({ ...model, ...design, id: 100 + index,
      x: 100 + index % 6 * 195, y: 770, scale: 1, state: 'watching', watchRemaining: 30, idle: null }));
    const results = [];
    for (const person of scene.world.crowd.people) {
      scene.update(0, 0);
      const visitor = scene.children.getByName('observer-' + person.id) as Phaser.GameObjects.Container;
      const sprite = visitor.getByName('observer-art') as Phaser.GameObjects.Sprite;
      const originalFrame = sprite.frame.name, originalAtlas = sprite.texture.key;
      const originalHeight = (sprite.frame.customData as AnimationFrameData).referenceHeight * sprite.scaleY;
      person.idle = { habit: signatures[person.age][person.look], elapsed: 0, duration: 3 };
      const poses = [];
      for (const progress of [.2, .4, .8]) {
        person.idle.elapsed = progress * 3; scene.update(0, 0);
        const data = sprite.frame.customData as AnimationFrameData;
        poses.push({ frame: sprite.frame.name, atlas: sprite.texture.key, height: data.referenceHeight * sprite.scaleY,
          footError: Math.abs((data.feet![0].y - sprite.displayOriginY) * sprite.scaleY),
          upright: sprite.rotation === 0 && sprite.scaleX === sprite.scaleY });
      }
      person.idle = null; scene.update(0, 0);
      const restored = sprite.frame.name === originalFrame && sprite.texture.key === originalAtlas;
      person.state = 'leaving'; person.stride = 2; scene.update(0, 0);
      results.push({ design: `observer-${person.age}-${person.look}`, originalHeight, poses, restored, walking: sprite.texture.key === 'people-walking' && sprite.frame.name.includes('-step-') });
      person.state = 'watching'; person.idle = { habit: signatures[person.age][person.look], elapsed: 1.5, duration: 3 };
    }
    // Keep six people in the scene for an uncluttered game-size review.
    scene.world.crowd.people = scene.world.crowd.people.filter((_, i) => i < 3 || i > 8);
    scene.world.crowd.people.forEach((person, i) => person.x = 100 + i * 195);
    scene.update(0, 0);
    return results;
  }, { designs: OBSERVER_DESIGNS, signatures: OBSERVER_SIGNATURES });
  expect(results).toHaveLength(12);
  for (const result of results) {
    expect(result.restored && result.walking).toBe(true);
    expect(result.poses.map(p => p.frame)).toEqual([1, 2, 3].map(i => `${result.design}-idle-${i}`));
    for (const pose of result.poses) {
      expect(pose.atlas).toBe('observer-idles'); expect(pose.upright).toBe(true);
      expect(pose.height).toBeCloseTo(result.originalHeight, 6);
      expect(pose.footError).toBeLessThan(.8);
    }
  }
  for (const [size, viewport] of [['desktop', { width: 1440, height: 1000 }], ['phone', { width: 390, height: 844 }]] as const) {
    await page.setViewportSize(viewport);
    await page.screenshot({ path: testInfo.outputPath(`visitor-idles-${size}.png`), fullPage: true });
  }
  // Actual loaded atlas cuts, including the resting frame, alongside main's
  // original watching/swimming pose at the same physical scale.
  const sheets = await page.evaluate(({ designs, strips }) => {
    const scene = (window as InspectedWindow).inspectedPond;
    return ['birds', 'adults', 'kids'].map(kind => {
      const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = kind === 'birds' ? 720 : 1500;
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#dbe6cf'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.imageSmoothingEnabled = false;
      const rows = kind === 'birds' ? strips.map((habit, row) => ({ name: habit, size: 78, atlas: 'animal-idles', prefix: habit,
        originalAtlas: 'bird-swimmers', original: `${['duck','gull','coot'][Math.floor(row/2)]}-e-0` }))
        : designs.filter(d => d.age === (kind === 'adults' ? 'adult' : 'kid')).map(d => ({ name: d.name, size: d.height,
          atlas: 'observer-idles', prefix: `${d.design}-idle`, originalAtlas: d.watchingInSheet ? 'people-walking' : 'garden-observers', original: `${d.design}-watch` }));
      rows.forEach((row, y) => {
        for (let col = 0; col < 5; col++) {
          const frame = scene.textures.get(col === 0 ? row.originalAtlas : row.atlas).get(col === 0 ? row.original : `${row.prefix}-${col-1}`);
          const data = frame.customData as AnimationFrameData, scale = row.size / data.referenceHeight;
          const anchorY = kind === 'birds' ? data.waterline!.y : data.feet![0].y;
          const x = col * 200 + 100, baseline = (y + 1) * canvas.height / 6 - 20;
          ctx.drawImage(frame.source.image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
            x + (frame.x - frame.realWidth/2) * scale, baseline + (frame.y-anchorY) * scale, frame.cutWidth*scale, frame.cutHeight*scale);
          ctx.fillStyle = '#304a3b'; ctx.font = '12px sans-serif'; ctx.fillText(col === 0 ? `${row.name}: original` : `pose ${col-1}`, col*200+8, baseline+16);
        }
      });
      return { kind, png: canvas.toDataURL('image/png').split(',')[1] };
    });
  }, { designs: OBSERVER_DESIGNS, strips: BIRD_IDLE_STRIPS });
  for (const sheet of sheets) await writeFile(testInfo.outputPath(`idle-${sheet.kind}-contact.png`), Buffer.from(sheet.png, 'base64'));
});

test('reduced motion keeps original poses while short idle commitments finish normally', async ({ page }) => {
  await arrive(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const result = await page.evaluate(() => {
    const scene = (window as InspectedWindow).inspectedPond;
    const bird = scene.world.animals.find(a => a.profile.id === 'duck')!;
    bird.idle = { habit: 'preen', elapsed: 1, duration: 3, heading: bird.heading }; bird.state = 'idle';
    const person = scene.world.crowd.people[0]; person.state = 'watching'; person.watchRemaining = 10;
    person.idle = { habit: 'adjust-clothes', elapsed: 1, duration: 3 };
    scene.update(0, 100);
    const birdArt = scene.children.getByName('animal-' + bird.id) as Phaser.GameObjects.Sprite;
    const personArt = (scene.children.getByName('observer-' + person.id) as Phaser.GameObjects.Container).getByName('observer-art') as Phaser.GameObjects.Sprite;
    const quiet = birdArt.texture.key === 'bird-swimmers' && personArt.texture.key !== 'observer-idles' && birdArt.rotation === 0 && personArt.rotation === 0;
    const frozen = bird.idle.elapsed === 1 && person.idle.elapsed === 1;
    bird.nextIdleAt = person.nextIdleAt = Infinity; scene.world.paused = false;
    for (let i = 0; i < 21; i++) scene.update(i*100, 100);
    return { quiet, frozen, finished: bird.idle === null && person.idle === null };
  });
  expect(result).toEqual({ quiet: true, frozen: true, finished: true });
});
