import { test, expect } from '@playwright/test';
import type Phaser from 'phaser';
import type { PondScene } from '../../src/game.ts';
import type { AnimationFrameData } from '../../src/animation-frames.ts';
import { walkingFrames } from '../../src/walking.ts';

type ReviewWindow = Window & { walkingComparison: PondScene };

test('comparison shows new walkers on the left and originals on the right immediately, including on a phone', async ({ page }, testInfo) => {
  const loaded = new Set<string>();
  page.on('requestfinished', request => loaded.add(new URL(request.url()).pathname));
  await page.addInitScript(() => document.addEventListener('pond:ready', event => {
    const scene = (event as CustomEvent<PondScene>).detail;
    (window as ReviewWindow).walkingComparison = scene;
    scene.scene.pause();
  }));
  await page.goto('/?walkCompare=1');
  await expect(page.locator('#loading')).toBeHidden({ timeout: 15_000 });
  const initial = await page.evaluate(() => {
    const scene = (window as ReviewWindow).walkingComparison;
    return { elapsed: scene.world.elapsed, people: scene.world.crowd.people.map(person => {
      const container = scene.children.getByName('observer-' + person.id) as Phaser.GameObjects.Container;
      const sprite = container.getByName('observer-art') as Phaser.GameObjects.Sprite;
      const label = container.getByName('walk-version-label') as Phaser.GameObjects.Text;
      const source = sprite.frame.source.image as HTMLImageElement;
      return { age: person.age, version: person.walkVersion, x: person.x, direction: person.direction,
        speed: person.speed, height: (sprite.frame.customData as AnimationFrameData).referenceHeight * sprite.scaleY,
        atlas: sprite.texture.key, wholeImage: source instanceof HTMLImageElement, label: label.text, flipped: sprite.flipX,
        frames: sprite.texture.getFrameNames().filter(name => name.startsWith(`observer-${person.age}-0-step-`)).length,
        sprites: container.list.filter(child => child.type === 'Sprite').length };
    }) };
  });
  expect(initial.elapsed).toBe(0);
  expect(initial.people).toHaveLength(4);
  for (const age of ['adult', 'kid']) {
    const current = initial.people.find(person => person.age === age && person.version === 'current')!;
    const original = initial.people.find(person => person.age === age && person.version === 'original')!;
    expect(current.x).toBeLessThan(600);
    expect(original.x).toBeGreaterThan(600);
    expect(current.direction).toBe(1);
    expect(original.direction).toBe(-1);
    expect(current.height).toBeCloseTo(original.height, 6);
    expect(current.speed).toBe(original.speed);
    expect(current.atlas).toBe('people-walking');
    expect(original.atlas).toBe('people-walking-original');
    expect(loaded.has(`/art/observer-${age}-0-walking-smooth.png`)).toBe(true);
    expect(loaded.has(`/art/observer-${age}-0-walking.png`)).toBe(true);
    expect(current.wholeImage).toBe(true);
    expect(original.wholeImage).toBe(true);
    expect(current.frames).toBe(walkingFrames(`observer-${age as 'adult' | 'kid'}-0`));
    expect(original.frames).toBe(8);
    expect(current.label).toBe('NEW →');
    expect(original.label).toBe('← ORIGINAL');
    expect(current.flipped).toBe(false);
    expect(original.flipped).toBe(true);
    expect(current.sprites).toBe(1);
    expect(original.sprites).toBe(1);
  }
  await page.screenshot({ path: testInfo.outputPath('walking-comparison-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => {
    const scene = (window as ReviewWindow).walkingComparison;
    return scene.game.canvas.getBoundingClientRect().width < 600;
  });
  const visibility = await page.evaluate(() => {
    const scene = (window as ReviewWindow).walkingComparison;
    const canvas = scene.game.canvas.getBoundingClientRect();
    const viewport = document.querySelector('#pond')!.getBoundingClientRect();
    return scene.world.crowd.people.map(person => {
      const container = scene.children.getByName('observer-' + person.id) as Phaser.GameObjects.Container;
      const bounds = container.getBounds();
      return { left: canvas.left + bounds.left * canvas.width / 1200 - viewport.left,
        right: viewport.right - canvas.left - bounds.right * canvas.width / 1200,
        bottom: viewport.bottom - canvas.top - bounds.bottom * canvas.height / 800 };
    });
  });
  for (const bounds of visibility) {
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeGreaterThanOrEqual(0);
    expect(bounds.bottom).toBeGreaterThanOrEqual(0);
  }
  await page.screenshot({ path: testInfo.outputPath('walking-comparison-phone.png'), fullPage: true });
  const playback = await page.evaluate(() => {
    const scene = (window as ReviewWindow).walkingComparison;
    const frames = new Map(scene.world.crowd.people.map(person => [person.id, [] as number[]]));
    for (let step = 0; step < 60 * 5; step++) {
      scene.update(step * 1000 / 60, 1000 / 60);
      for (const person of scene.world.crowd.people) {
        const container = scene.children.getByName('observer-' + person.id) as Phaser.GameObjects.Container;
        const index = Number(String((container.getByName('observer-art') as Phaser.GameObjects.Sprite).frame.name).split('-step-')[1]);
        const sequence = frames.get(person.id)!;
        if (sequence.at(-1) !== index) sequence.push(index);
      }
    }
    const moved = scene.world.crowd.people.map(person => ({ version: person.walkVersion, state: person.state,
      poses: new Set(frames.get(person.id)!).size, sequence: frames.get(person.id)! }));
    scene.world.paused = true;
    const before = scene.world.crowd.people.map(person => [person.x, person.stride]);
    scene.update(6000, 100);
    const after = scene.world.crowd.people.map(person => [person.x, person.stride]);
    scene.restart();
    return { moved, before, after, restarted: scene.world.crowd.people.map(person => ({ version: person.walkVersion, x: person.x })) };
  });
  for (const person of playback.moved) {
    expect(person.state).toBe('walking');
    const count = person.version === 'original' ? 8 : 48;
    expect(person.poses).toBe(count);
    for (let i = 1; i < person.sequence.length; i++) expect(person.sequence[i]).toBe((person.sequence[i - 1] + 1) % count);
  }
  expect(playback.after).toEqual(playback.before);
  expect(playback.restarted).toEqual(initial.people.map(person => ({ version: person.version, x: person.x })));
});
