import { test, expect, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import type Phaser from 'phaser';
import type { PondScene } from '../../src/game.ts';
import type { PondSimulation, Food } from '../../src/simulation.ts';
import type { AnimationFrameData } from '../../src/animation-frames.ts';
import { DIRECTIONS } from '../../src/appearance.ts';

type PondWindow = Window & { inspectedPond: PondScene };
async function arrive(page: Page): Promise<void> {
  await page.addInitScript(() => document.addEventListener('pond:ready', event => {
    (window as PondWindow).inspectedPond = (event as CustomEvent<PondScene>).detail;
  }));
  await page.goto('/'); await expect(page.locator('#loading')).toBeHidden();
  await page.evaluate(() => {
    const scene = (window as PondWindow).inspectedPond;
    scene.scene.pause();
    const Simulation = scene.world.constructor as new (seed: number) => PondSimulation;
    scene.world = new Simulation(801);
    // Keep the regular residents in the rendered scene, but isolate the feeding
    // event from competition so this exercises the complete visit deterministically.
    for (const animal of scene.world.animals) if (animal.profile.kind !== 'turtle') animal.chewLeft = 1000;
    scene.update(0, 0);
  });
}
async function advance(page: Page, seconds: number): Promise<void> {
  await page.evaluate(seconds => {
    const scene = (window as PondWindow).inspectedPond;
    for (let time = 0; time < seconds-1e-8; time += .05) scene.update(0, Math.min(.05,seconds-time)*1000);
  }, seconds);
}
async function feed(page: Page, species: string, id: number): Promise<void> {
  await page.evaluate(({ species, id }) => {
    const scene = (window as PondWindow).inspectedPond;
    const animal = scene.world.animals.find(a => a.profile.id === species)!;
    animal.idle = null; animal.nextIdleAt = Infinity;
    const point = { x: animal.x, y: animal.y };
    const food: Food = { ...point, origin: point, target: point, id, throwId: id, amount: species === 'swan' ? 1 : .2,
      age: 0, phase: 'water', flightTime: 1, flightDuration: 1, height: 0, launchHeight: 0,
      releaseAt: 0, arcScale: 1, lucky: false, bonusClaimed: false };
    scene.world.food = [food]; scene.update(0, 50);
  }, { species, id });
}

for (const reduced of [false, true]) test(`the turtle invites a repeatable two-bite swan visit${reduced ? ' with reduced motion' : ''}`, async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await arrive(page);
  expect(await page.evaluate(() => (window as PondWindow).inspectedPond.world.animals.some(a => a.profile.id === 'swan'))).toBe(false);
  await feed(page, 'musk-turtle', 100);
  const delay = await page.evaluate(() => {
    const world = (window as PondWindow).inspectedPond.world;
    return world.swan.arrivesAt! - world.elapsed;
  });
  expect(delay).toBeGreaterThanOrEqual(10); expect(delay).toBeLessThanOrEqual(15);
  await advance(page, delay-.1);
  expect(await page.evaluate(() => (window as PondWindow).inspectedPond.world.swan.phase)).toBe('waiting');
  await advance(page, .15);
  const flight = await page.evaluate(() => {
    const scene = (window as PondWindow).inspectedPond;
    const swan = scene.world.animals.find(a => a.profile.id === 'swan')!;
    swan.nextIdleAt = Infinity;
    const sprite = scene.children.getByName('animal-'+swan.id) as Phaser.GameObjects.Sprite;
    return { id: swan.id, duration: swan.flight!.duration, atlas: sprite.texture.key, frame: sprite.frame.name };
  });
  expect(flight.atlas).toBe('swan'); expect(flight.frame).toContain('swan-flight-');
  await advance(page, flight.duration*.55);
  if (!reduced) await page.screenshot({ path: testInfo.outputPath('swan-arriving.png'), fullPage: true });
  expect(await page.evaluate(() => {
    const scene = (window as PondWindow).inspectedPond;
    const swan = scene.world.animals.find(a => a.profile.id === 'swan')!;
    const sprite = scene.children.getByName('animal-'+swan.id) as Phaser.GameObjects.Sprite;
    const before = [swan.x,swan.y,swan.altitude,scene.world.elapsed,sprite.frame.name];
    scene.world.paused = true; scene.update(0,100); scene.world.paused = false;
    return JSON.stringify(before) === JSON.stringify([swan.x,swan.y,swan.altitude,scene.world.elapsed,sprite.frame.name]);
  })).toBe(true);
  await advance(page, flight.duration*.5);
  expect(await page.evaluate(() => (window as PondWindow).inspectedPond.world.swan.phase)).toBe('visiting');
  if (!reduced) {
    await page.screenshot({ path: testInfo.outputPath('swan-swimming-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: testInfo.outputPath('swan-swimming-phone.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await feed(page, 'swan', 101);
  expect(await page.evaluate(() => (window as PondWindow).inspectedPond.world.swan.meals)).toBe(1);
  await advance(page, 2.7);
  expect(await page.evaluate(() => (window as PondWindow).inspectedPond.world.swan.phase)).toBe('visiting');
  await feed(page, 'swan', 102);
  const eating = await page.evaluate(id => {
    const scene = (window as PondWindow).inspectedPond;
    const sprite = scene.children.getByName('animal-'+id) as Phaser.GameObjects.Sprite;
    return { frame: sprite.frame.name, count: scene.world.swan.meals, phase: scene.world.swan.phase };
  }, flight.id);
  expect(eating.frame).toContain('-bite'); expect(eating.count).toBe(2); expect(eating.phase).toBe('visiting');
  if (!reduced) await page.screenshot({ path: testInfo.outputPath('swan-second-bite.png'), fullPage: true });
  await advance(page, 2.7);
  expect(await page.evaluate(() => (window as PondWindow).inspectedPond.world.swan.phase)).toBe('departing');
  await advance(page, 1.1);
  if (!reduced) await page.screenshot({ path: testInfo.outputPath('swan-departing.png'), fullPage: true });
  await advance(page, 7);
  expect(await page.evaluate(id => {
    const scene = (window as PondWindow).inspectedPond;
    return { phase: scene.world.swan.phase, actor: scene.world.animals.some(a => a.id === id), sprite: !!scene.children.getByName('animal-'+id) };
  }, flight.id)).toEqual({ phase: 'away', actor: false, sprite: false });
  await feed(page, 'musk-turtle', 103); await advance(page, 15.1);
  expect(await page.evaluate(id => {
    const scene = (window as PondWindow).inspectedPond;
    const swans = scene.world.animals.filter(a => a.profile.id === 'swan');
    const valid = swans.length === 1 && swans[0].id !== id && scene.world.swan.meals === 0;
    scene.restart(); scene.update(0, 0);
    return valid && scene.world.swan.phase === 'away' && !scene.children.list.some(child => child.name.startsWith('animal-') &&
      (child as Phaser.GameObjects.Sprite).texture?.key === 'swan');
  }, flight.id)).toBe(true);
  expect(errors).toEqual([]);
});

test('all swan headings and poses load intact with stable waterline and torso registration', async ({ page }, testInfo) => {
  await arrive(page);
  const result = await page.evaluate(directions => {
    const scene = (window as PondWindow).inspectedPond;
    const texture = scene.textures.get('swan');
    const kinds = ['swimming', 'flight', 'eating'] as const;
    const checks = [];
    const sheets = kinds.map(kind => {
      const columns = kind === 'eating' ? 3 : 4;
      const canvas = document.createElement('canvas'); canvas.width = columns*250; canvas.height = directions.length*180;
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#b8cdb4'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.imageSmoothingEnabled = false;
      for (const [row, direction] of directions.entries()) {
        const scales = [];
        for (let col = 0; col < columns; col++) {
          const name = kind === 'flight' ? `swan-flight-${direction}-${col}` : `swan-${direction}-${kind === 'eating' ? ['bite','chew','swallow'][col] : col}`;
          if (!texture.has(name)) throw new Error('Missing pose '+name);
          const f = texture.get(name), data = f.customData as AnimationFrameData & { bodyAnchor?: { x: number; y: number } };
          const scale = 92/data.referenceHeight; scales.push(scale);
          const pin = kind === 'flight' ? data.bodyAnchor! : data.waterline!;
          const anchorError = Math.abs((pin.y-256)*scale-(kind === 'flight' ? 0 : .2*92));
          checks.push({ name, anchorError, width: f.cutWidth*scale, height: f.cutHeight*scale,
            inside: f.cutX>=0 && f.cutY>=0 && f.cutX+f.cutWidth<=f.source.width && f.cutY+f.cutHeight<=f.source.height });
          const x=col*250+125, y=row*180+112;
          ctx.drawImage(f.source.image,f.cutX,f.cutY,f.cutWidth,f.cutHeight,x+(f.x-256)*scale,y+(f.y-256)*scale,f.cutWidth*scale,f.cutHeight*scale);
          ctx.fillStyle='#284437';ctx.font='13px sans-serif';ctx.fillText(name,col*250+10,row*180+168);
          ctx.fillStyle='#e77f3e';ctx.fillRect(x-1,y-1,2,2);
        }
        if (new Set(scales).size !== 1) throw new Error('Pose scale changed during '+kind+' '+direction);
      }
      return { kind, png:canvas.toDataURL('image/png').split(',')[1] };
    });
    return { checks, sheets, frameCount: Object.keys(texture.frames).filter(name => !name.startsWith('__BASE')).length };
  }, DIRECTIONS);
  expect(result.frameCount).toBe(88); expect(result.checks).toHaveLength(88);
  for (const check of result.checks) {
    expect(check.inside).toBe(true); expect(check.anchorError).toBeLessThan(.5);
    expect(check.width).toBeGreaterThan(30); expect(check.width).toBeLessThan(210);
    expect(check.height).toBeGreaterThan(30); expect(check.height).toBeLessThan(160);
  }
  for (const sheet of result.sheets) await writeFile(testInfo.outputPath(`swan-${sheet.kind}-frames.png`),Buffer.from(sheet.png,'base64'));
});
