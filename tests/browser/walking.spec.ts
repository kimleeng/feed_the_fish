import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import type Phaser from 'phaser';
import type { PondScene } from '../../src/game.ts';
import type { AnimationFrameData } from '../../src/animation-frames.ts';
import { WALKING_GAIT } from '../../src/walking-gait.ts';
import { walkingDistance } from '../../src/walking.ts';

test('both illustrated steps keep their supporting shoe in place at each authored pose', async ({ page }, testInfo) => {
  await page.addInitScript(() => document.addEventListener('pond:ready', event => {
    (window as Window & { walkingReview: PondScene }).walkingReview = (event as CustomEvent<PondScene>).detail;
  }));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  const configurations = (['adult', 'kid'] as const).map(age => {
    const design = `observer-${age}-0` as const;
    return { age, phases: WALKING_GAIT[design].phases, ratio: walkingDistance(design, 1), height: age === 'adult' ? 158 : 109 };
  });
  const result = await page.evaluate(configurations => {
    const scene = (window as Window & { walkingReview: PondScene }).walkingReview;
    scene.scene.pause();
    const model = scene.world.crowd.people[0];
    const sources = new Map<CanvasImageSource, CanvasRenderingContext2D>();
    const sheet = document.createElement('canvas'); sheet.width = 800; sheet.height = 440;
    const drawing = sheet.getContext('2d')!; drawing.imageSmoothingEnabled = false;
    drawing.fillStyle = '#e3e9de'; drawing.fillRect(0, 0, sheet.width, sheet.height);
    const groups: number[][] = [], keys: string[][] = [];
    let painted = 0, samples = 0, maxGroundError = 0;
    configurations.forEach((configuration, row) => {
      const keyNames = new Set<string>();
      for (const direction of [1, -1] as const) for (const scale of [.92, 1, 1.08]) {
        const person = { ...model, id: 9000, age: configuration.age, look: 0, scale, direction, x: 400, y: 760, lane: 760,
          stride: 0, state: 'walking' as const, stop: null, hasWatched: true };
        scene.world.crowd.people = [person];
        const supports = { near: [] as number[], far: [] as number[] };
        for (const phase of configuration.phases) {
          person.x = 400 + direction * configuration.ratio * configuration.height * scale * phase;
          person.stride = phase * 4;
          scene.update(0, 0);
          const container = scene.children.getByName('observer-9000') as Phaser.GameObjects.Container;
          const sprite = container.getByName('observer-art') as Phaser.GameObjects.Sprite;
          const frame = sprite.frame, data = frame.customData as AnimationFrameData;
          if (!data.supportFoot || !data.supportLeg || data.posePhase === undefined || Math.abs(data.posePhase - phase) > 1e-7) {
            throw new Error('Missing or incorrect supporting-foot annotation');
          }
          const x = container.x + (data.supportFoot.x - sprite.displayOriginX) * sprite.scaleX * direction;
          const y = container.y + (data.supportFoot.y - sprite.displayOriginY) * sprite.scaleY;
          supports[data.supportLeg].push(x);
          maxGroundError = Math.max(maxGroundError, Math.abs(y - person.y));
          const source = frame.source.image as HTMLImageElement;
          let context = sources.get(source);
          if (!context) {
            const canvas = document.createElement('canvas'); canvas.width = source.naturalWidth; canvas.height = source.naturalHeight;
            context = canvas.getContext('2d', { willReadFrequently: true })!; context.drawImage(source, 0, 0); sources.set(source, context);
          }
          const px = frame.cutX + data.supportFoot.x - frame.x, py = frame.cutY + data.supportFoot.y - frame.y;
          const ink = context.getImageData(Math.round(px) - 6, Math.round(py) - 13, 13, 13).data;
          let brown = 0;
          for (let i = 0; i < ink.length; i += 4) if (ink[i + 3] >= 128 && ink[i] > 15 && ink[i] < 200 && ink[i + 1] < ink[i] * .9 && ink[i + 2] < ink[i + 1]) brown++;
          if (brown >= 8) painted++;
          samples++;
          if (data.keyPose && direction === 1 && scale === 1) {
            const column = ['near-contact', 'far-passing', 'far-contact', 'near-passing'].indexOf(data.keyPose);
            const baseline = row * 220 + 203, center = column * 200 + 100;
            drawing.drawImage(source, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
              center + (frame.x - sprite.displayOriginX) * sprite.scaleX, baseline + (frame.y - sprite.displayOriginY) * sprite.scaleY,
              frame.cutWidth * sprite.scaleX, frame.cutHeight * sprite.scaleY);
            drawing.fillStyle = '#344c3a'; drawing.font = '11px sans-serif'; drawing.fillText(data.keyPose, column * 200 + 8, row * 220 + 15);
            keyNames.add(data.keyPose);
          }
        }
        groups.push(supports.near, supports.far);
      }
      keys.push([...keyNames]);
    });
    return { drift: groups.map(group => Math.max(...group) - Math.min(...group)), keys, painted, samples, maxGroundError,
      sheet: sheet.toDataURL().split(',')[1] };
  }, configurations);
  for (const drift of result.drift) expect(drift).toBeLessThan(.8);
  expect(result.maxGroundError).toBeLessThan(1.5);
  expect(result.painted).toBe(result.samples);
  for (const keys of result.keys) expect(new Set(keys)).toEqual(new Set(['near-contact', 'far-passing', 'far-contact', 'near-passing']));
  await fs.writeFile(testInfo.outputPath('four-key-walking-poses.png'), Buffer.from(result.sheet, 'base64'));
});
