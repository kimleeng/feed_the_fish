import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import type Phaser from 'phaser';
import type { PondScene } from '../../src/game.ts';
import type { AnimationFrameData } from '../../src/animation-frames.ts';

type ReviewWindow = Window & { walkingReview: PondScene };

test('both originals display all eight intact source cells in row order through the loop', async ({ page }, testInfo) => {
  const sources = await Promise.all((['adult', 'kid'] as const).map(async age => ({
    age, png: 'data:image/png;base64,' + (await fs.readFile(
      new URL(`../../public/art/observer-${age}-0-walking.png`, import.meta.url))).toString('base64'),
  })));
  await page.addInitScript(() => document.addEventListener('pond:ready', event => {
    const scene = (event as CustomEvent<PondScene>).detail;
    (window as ReviewWindow).walkingReview = scene;
    scene.scene.pause();
  }));
  await page.goto('/?walkReview=1');
  await expect(page.locator('#loading')).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('originals-in-garden.png'), fullPage: true });
  const result = await page.evaluate(async sources => {
    const scene = (window as ReviewWindow).walkingReview;
    const model = scene.world.crowd.people[0], measurements = [];
    const sheet = document.createElement('canvas'); sheet.width = 800; sheet.height = 880;
    const drawing = sheet.getContext('2d')!; drawing.imageSmoothingEnabled = false;
    drawing.fillStyle = '#e3e9de'; drawing.fillRect(0, 0, sheet.width, sheet.height);
    for (const [row, { age, png }] of sources.entries()) {
      const original = new Image(); original.src = png; await original.decode();
      const source = document.createElement('canvas'); source.width = original.width; source.height = original.height;
      const sourceContext = source.getContext('2d', { willReadFrequently: true })!;
      sourceContext.drawImage(original, 0, 0);
      const cellWidth = original.width / 4, cellHeight = original.height / 2;
      for (const direction of [1, -1] as const) {
        const person = { ...model, id: 9000, age, direction, look: 0, scale: 1,
          x: 600, y: 760, lane: 760, stride: 0, state: 'walking' as const, stop: null, hasWatched: true };
        scene.world.crowd.people = [person];
        for (let phase = 0; phase <= 8; phase++) {
          const index = phase % 8;
          person.stride = phase / 2;
          scene.update(0, 0);
          const container = scene.children.getByName('observer-9000') as Phaser.GameObjects.Container;
          const sprite = container.getByName('observer-art') as Phaser.GameObjects.Sprite, f = sprite.frame;
          const actual = document.createElement('canvas'); actual.width = f.cutWidth; actual.height = f.cutHeight;
          const context = actual.getContext('2d', { willReadFrequently: true })!;
          context.drawImage(f.source.image as HTMLImageElement, f.cutX, f.cutY, f.cutWidth, f.cutHeight,
            0, 0, actual.width, actual.height);
          const a = context.getImageData(0, 0, actual.width, actual.height).data;
          const b = sourceContext.getImageData(f.cutX, f.cutY, actual.width, actual.height).data;
          let different = 0, painted = 0, omitted = 0;
          for (let p = 0; p < a.length; p += 4) {
            if (Math.max(a[p + 3], b[p + 3]) < 32) continue;
            painted++;
            if (a[p] !== b[p] || a[p + 1] !== b[p + 1] || a[p + 2] !== b[p + 2] || a[p + 3] !== b[p + 3]) different++;
          }
          const left = index % 4 * cellWidth, top = Math.floor(index / 4) * cellHeight;
          const cell = sourceContext.getImageData(left, top, cellWidth, cellHeight).data;
          for (let y = 0; y < cellHeight; y++) for (let x = 0; x < cellWidth; x++) {
            if (cell[(y * cellWidth + x) * 4 + 3] < 128) continue;
            if (left + x < f.cutX || left + x >= f.cutX + f.cutWidth || top + y < f.cutY || top + y >= f.cutY + f.cutHeight) omitted++;
          }
          measurements.push({ age, direction, phase, index, name: f.name, flipped: sprite.flipX,
            column: Math.floor(f.cutX / cellWidth), row: Math.floor(f.cutY / cellHeight),
            different, painted, omitted, sprites: container.list.filter(child => child.type === 'Sprite').length,
            baseline: f.y + f.cutHeight - f.realHeight });
          if (direction === 1 && phase < 8) {
            const x = index % 4 * 200 + 100, y = row * 440 + Math.floor(index / 4) * 220 + 206;
            drawing.drawImage(f.source.image as HTMLImageElement, f.cutX, f.cutY, f.cutWidth, f.cutHeight,
              x + (f.x - sprite.displayOriginX) * sprite.scaleX,
              y + (f.y - sprite.displayOriginY) * sprite.scaleY, f.cutWidth * sprite.scaleX, f.cutHeight * sprite.scaleY);
            drawing.strokeStyle = '#a4b6a5'; drawing.beginPath(); drawing.moveTo(x - 94, y + .5); drawing.lineTo(x + 94, y + .5); drawing.stroke();
            drawing.fillStyle = '#344c3a'; drawing.font = '12px sans-serif';
            const height = (f.customData as AnimationFrameData).referenceHeight * sprite.scaleY;
            drawing.fillText(`${age} · frame ${index} · ${height.toFixed(0)} px`, x - 91, y - 185);
          }
        }
      }
    }
    return { measurements, sheet: sheet.toDataURL().split(',')[1] };
  }, sources);
  await fs.writeFile(testInfo.outputPath('original-eight-poses.png'), Buffer.from(result.sheet, 'base64'));
  await fs.writeFile(testInfo.outputPath('original-frame-audit.json'), JSON.stringify(result.measurements, null, 2));
  expect(result.measurements).toHaveLength(36);
  for (const frame of result.measurements) {
    expect(frame.name).toBe(`observer-${frame.age}-0-step-${frame.index}`);
    expect(frame.flipped).toBe(frame.direction === -1);
    expect(frame.column).toBe(frame.index % 4);
    expect(frame.row).toBe(Math.floor(frame.index / 4));
    expect(frame.painted).toBeGreaterThan(1000);
    expect(frame.different).toBe(0);
    expect(frame.omitted).toBe(0);
    expect(frame.sprites).toBe(1);
    expect(frame.baseline).toBe(0);
  }
});
