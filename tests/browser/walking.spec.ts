import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import type Phaser from 'phaser';
import type { PondScene } from '../../src/game.ts';
import type { AnimationFrameData } from '../../src/animation-frames.ts';
import { WALKING_GAIT } from '../../src/walking-gait.ts';
import { walkingDistance } from '../../src/walking.ts';

test('every authored walking pose survives in row order between the in-betweens', async ({ page }, testInfo) => {
  const sources = await Promise.all((['adult', 'kid'] as const).map(async age => {
    const root = `../../art-source/walking/observer-${age}-0`;
    const source = JSON.parse(await fs.readFile(new URL(root + '-poses.json', import.meta.url), 'utf8'));
    const calibration = JSON.parse(await fs.readFile(new URL(root + '.json', import.meta.url), 'utf8'));
    return { age, source, output: calibration.output,
      png: 'data:image/png;base64,' + (await fs.readFile(new URL(root + '-poses.png', import.meta.url))).toString('base64') };
  }));
  await page.addInitScript(() => document.addEventListener('pond:ready', event => {
    (window as Window & { walkingReview: PondScene }).walkingReview = (event as CustomEvent<PondScene>).detail;
  }));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  const comparisons = await page.evaluate(async sources => {
    const scene = (window as Window & { walkingReview: PondScene }).walkingReview;
    scene.scene.pause();
    const results = [];
    for (const { age, source, output, png } of sources) {
      const image = new Image(); image.src = png; await image.decode();
      const expected = document.createElement('canvas'), actual = document.createElement('canvas');
      expected.width = expected.height = actual.width = actual.height = output.cell;
      const before = expected.getContext('2d', { willReadFrequently: true })!;
      const after = actual.getContext('2d', { willReadFrequently: true })!;
      const scale = output.height / source.height;
      for (let pose = 0; pose < source.frames; pose++) {
        before.clearRect(0, 0, output.cell, output.cell);
        before.drawImage(image, pose % source.columns * source.cell, Math.floor(pose / source.columns) * source.cell,
          source.cell, source.cell, output.cell / 2 - source.cell / 2 * scale,
          output.ground - source.ground * scale, source.cell * scale, source.cell * scale);
        const frame = scene.textures.getFrame('people-walking', `observer-${age}-0-step-${pose * 2}`)!;
        after.clearRect(0, 0, output.cell, output.cell);
        after.drawImage(frame.source.image as HTMLImageElement,
          Math.floor(frame.cutX / output.cell) * output.cell, Math.floor(frame.cutY / output.cell) * output.cell,
          output.cell, output.cell, 0, 0, output.cell, output.cell);
        const a = before.getImageData(0, 0, output.cell, output.cell).data;
        const b = after.getImageData(0, 0, output.cell, output.cell).data;
        let painted = 0, different = 0;
        for (let p = 0; p < a.length; p += 4) {
          if (Math.max(a[p + 3], b[p + 3]) < 32) continue;
          painted++;
          let delta = Math.abs(a[p + 3] - b[p + 3]);
          for (let channel = 0; channel < 3; channel++) delta = Math.max(delta,
            Math.abs(a[p + channel] * a[p + 3] / 255 - b[p + channel] * b[p + 3] / 255));
          if (delta > 8) different++;
        }
        results.push({ age, pose, frame: pose * 2, painted, different, ratio: different / painted });
      }
    }
    return results;
  }, sources);
  await fs.writeFile(testInfo.outputPath('authored-pose-order.json'), JSON.stringify(comparisons, null, 2));
  expect(comparisons).toHaveLength(48);
  for (const pose of comparisons) expect(pose.ratio,
    `${pose.age}: source pose ${pose.pose} is missing or altered at output frame ${pose.frame}`).toBeLessThan(.01);
});

test('trial walkers keep opaque limbs through every in-between frame', async ({ page }, testInfo) => {
  await page.addInitScript(() => document.addEventListener('pond:ready', event => {
    (window as Window & { walkingReview: PondScene }).walkingReview = (event as CustomEvent<PondScene>).detail;
  }));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  const measurements = await page.evaluate(() => {
    const scene = (window as Window & { walkingReview: PondScene }).walkingReview;
    scene.scene.pause();
    const results = [];
    for (const age of ['adult', 'kid']) {
      for (let index = 0; index < 48; index++) {
        const frame = scene.textures.getFrame('people-walking', `observer-${age}-0-step-${index}`)!;
        const data = frame.customData as AnimationFrameData;
        const canvas = document.createElement('canvas'); canvas.width = frame.cutWidth; canvas.height = frame.cutHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true })!;
        context.drawImage(frame.source.image as HTMLImageElement, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
          0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let opaque = 0, trails = 0;
        const top = Math.max(0, Math.floor(frame.realHeight - data.referenceHeight * .55 - frame.y));
        for (let y = top; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
          const alpha = pixels[(y * canvas.width + x) * 4 + 3];
          if (alpha >= 220) opaque++;
          if (alpha <= 24 || alpha >= 196) continue;
          // Painted edge softness is fine. A translucent region several pixels
          // away from any solid figure is the duplicate-limb trail we reject.
          let edge = false;
          for (let dy = -2; dy <= 2 && !edge; dy++) for (let dx = -2; dx <= 2; dx++) {
            if (x + dx >= 0 && x + dx < canvas.width && y + dy >= 0 && y + dy < canvas.height &&
              pixels[((y + dy) * canvas.width + x + dx) * 4 + 3] >= 220) { edge = true; break; }
          }
          if (!edge) trails++;
        }
        results.push({ age, index, opaque, trails, ratio: trails / opaque });
      }
    }
    return results;
  });
  await fs.writeFile(testInfo.outputPath('walking-opacity.json'), JSON.stringify(measurements, null, 2));
  expect(measurements).toHaveLength(96);
  for (const frame of measurements) {
    expect(frame.opaque, `${frame.age} frame ${frame.index} has no solid body`).toBeGreaterThan(1500);
    expect(frame.ratio, `${frame.age} frame ${frame.index} has translucent limb trails`).toBeLessThan(.02);
  }
});

test('both illustrated steps render supporting shoes and rear extension at their authored poses', async ({ page }, testInfo) => {
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
    let painted = 0, samples = 0, rearPainted = 0, rearSamples = 0, maxGroundError = 0;
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
          const paintedFoot = (data.supportLeg === 'near' ? data.nearFoot : data.farFoot) ?? data.supportFoot;
          const px = frame.cutX + paintedFoot.x - frame.x, py = frame.cutY + paintedFoot.y - frame.y;
          const ink = context.getImageData(Math.round(px) - 6, Math.round(py) - 6, 13, 13).data;
          let brown = 0;
          for (let i = 0; i < ink.length; i += 4) if (ink[i + 3] >= 128 && ink[i] > 15 && ink[i] < 200 && ink[i + 1] < ink[i] * .9 && ink[i + 2] < ink[i + 1]) brown++;
          if (brown >= 8) painted++;
          samples++;
          if (data.keyPose?.endsWith('contact')) {
            const back = data.keyPose === 'near-contact' ? data.farFoot : data.nearFoot;
            if (!back || !data.hip || data.hip.x - back.x < data.referenceHeight * .1) throw new Error('Missing rear-leg extension');
            const bx = frame.cutX + back.x - frame.x, by = frame.cutY + back.y - frame.y;
            const ink = context.getImageData(Math.round(bx) - 6, Math.round(by) - 6, 13, 13).data;
            let brown = 0;
            for (let i = 0; i < ink.length; i += 4) if (ink[i + 3] >= 128 && ink[i] > 15 && ink[i] < 200 && ink[i + 1] < ink[i] * .9 && ink[i + 2] < ink[i + 1]) brown++;
            if (brown >= 8) rearPainted++;
            rearSamples++;
          }
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
    return { drift: groups.map(group => Math.max(...group) - Math.min(...group)), keys, painted, samples, rearPainted, rearSamples, maxGroundError,
      sheet: sheet.toDataURL().split(',')[1] };
  }, configurations);
  for (const drift of result.drift) expect(drift).toBeLessThan(.8);
  expect(result.maxGroundError).toBeLessThan(1.5);
  expect(result.painted).toBe(result.samples);
  expect(result.rearSamples).toBe(24);
  expect(result.rearPainted).toBe(result.rearSamples);
  for (const keys of result.keys) expect(new Set(keys)).toEqual(new Set(['near-contact', 'far-passing', 'far-contact', 'near-passing']));
  await fs.writeFile(testInfo.outputPath('four-key-walking-poses.png'), Buffer.from(result.sheet, 'base64'));
});

test('the yellow child swings its painted foot forward without snapping back before the loop', async ({ page }, testInfo) => {
  await page.addInitScript(() => document.addEventListener('pond:ready', event => {
    (window as Window & { walkingReview: PondScene }).walkingReview = (event as CustomEvent<PondScene>).detail;
  }));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  const result = await page.evaluate(({ phases, distance }) => {
    const scene = (window as Window & { walkingReview: PondScene }).walkingReview;
    scene.scene.pause();
    const model = scene.world.crowd.people[0], measurements = [];
    const passingIndex = phases.findIndex((_, index) =>
      (scene.textures.getFrame('people-walking', `observer-kid-0-step-${index}`)!.customData as AnimationFrameData).keyPose === 'near-passing');
    const sheet = document.createElement('canvas'); sheet.width = 800; sheet.height = Math.ceil((phases.length - passingIndex + 1) / 4) * 220;
    const drawing = sheet.getContext('2d')!; drawing.fillStyle = '#e3e9de'; drawing.fillRect(0, 0, sheet.width, sheet.height);
    const feet = new Map<string, { x: number; y: number }[]>();
    for (const direction of [-1, 1] as const) for (const scale of [.92, 1, 1.1]) {
      const person = { ...model, id: 9001, age: 'kid' as const, look: 0, scale, direction,
        x: 400, y: 760, lane: 760, stride: 0, state: 'walking' as const, stop: null, hasWatched: true };
      scene.world.crowd.people = [person];
      const trace = []; let passing = false;
      for (const [index, phase] of [...phases, 1].entries()) {
        person.stride = phase * 4; person.x = 400 + direction * distance * scale * phase;
        scene.update(0, 0);
        const container = scene.children.getByName('observer-9001') as Phaser.GameObjects.Container;
        const sprite = container.getByName('observer-art') as Phaser.GameObjects.Sprite, f = sprite.frame;
        const data = f.customData as AnimationFrameData;
        passing ||= data.keyPose === 'near-passing';
        if (!passing) continue;
        if (!data.supportFoot || !data.supportLeg) throw new Error('Missing supporting shoe');
        let centers = feet.get(String(f.name));
        if (!centers) {
          const c = document.createElement('canvas'); c.width = f.cutWidth; c.height = f.cutHeight;
          const g = c.getContext('2d', { willReadFrequently: true })!;
          g.drawImage(f.source.image as HTMLImageElement, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, c.width, c.height);
          const pixels = g.getImageData(0, 0, c.width, c.height).data, brown = [];
          for (let y = Math.max(0, Math.floor(f.realHeight - data.referenceHeight * .27 - f.y)); y < c.height; y++) {
            for (let x = 0; x < c.width; x++) {
              const n = (y * c.width + x) * 4, r = pixels[n], green = pixels[n + 1], b = pixels[n + 2];
              if (pixels[n + 3] >= 128 && r > 25 && r < 195 && green < r * .81 && b < green * .91) brown.push({ x: f.x + x, y: f.y + y });
            }
          }
          if (brown.length < 100) throw new Error('Missing painted brown shoes');
          brown.sort((a, b) => a.x - b.x);
          centers = [brown[Math.floor(brown.length * .15)], brown[Math.floor(brown.length * .85)]];
          for (let iteration = 0; iteration < 24; iteration++) {
            const groups: { x: number; y: number }[][] = [[], []];
            for (const p of brown) {
              const d = centers.map(q => (p.x - q.x) ** 2 + (p.y - q.y) ** 2);
              groups[d[0] <= d[1] ? 0 : 1].push(p);
            }
            centers = groups.map(group => ({ x: group.reduce((sum, p) => sum + p.x, 0) / group.length,
              y: group.reduce((sum, p) => sum + p.y, 0) / group.length }));
          }
          feet.set(String(f.name), centers);
        }
        const support = data.supportFoot;
        const distances = centers.map(p => (p.x - support.x) ** 2 + (p.y - support.y) ** 2);
        const supportIndex = distances[0] <= distances[1] ? 0 : 1;
        const near = centers[data.supportLeg === 'near' ? supportIndex : 1 - supportIndex];
        const worldX = container.x + direction * (near.x - sprite.displayOriginX) * sprite.scaleX;
        trace.push({ frame: String(f.name), phase, forward: direction * worldX });
        if (direction === 1 && scale === 1) {
          const cell = trace.length - 1, x = cell % 4 * 200 + 100, baseline = Math.floor(cell / 4) * 220 + 190;
          drawing.drawImage(f.source.image as HTMLImageElement, f.cutX, f.cutY, f.cutWidth, f.cutHeight,
            x + (f.x - sprite.displayOriginX) * sprite.scaleX, baseline + (f.y - sprite.displayOriginY) * sprite.scaleY,
            f.cutWidth * sprite.scaleX, f.cutHeight * sprite.scaleY);
          drawing.fillStyle = '#344c3a'; drawing.font = '11px monospace';
          drawing.fillText(`${index % phases.length} / ${phase.toFixed(3)}`, cell % 4 * 200 + 12, Math.floor(cell / 4) * 220 + 20);
          drawing.fillStyle = '#ce493d'; drawing.beginPath();
          drawing.arc(x + (near.x - sprite.displayOriginX) * sprite.scaleX,
            baseline + (near.y - sprite.displayOriginY) * sprite.scaleY, 2, 0, Math.PI * 2); drawing.fill();
        }
      }
      measurements.push({ direction, scale, trace,
        backwards: Math.max(0, ...trace.slice(1).map((p, i) => trace[i].forward - p.forward)) });
    }
    return { measurements, sheet: sheet.toDataURL().split(',')[1] };
  }, { phases: WALKING_GAIT['observer-kid-0'].phases, distance: walkingDistance('observer-kid-0', 109) });
  await fs.writeFile(testInfo.outputPath('yellow-child-swing.png'), Buffer.from(result.sheet, 'base64'));
  await fs.writeFile(testInfo.outputPath('yellow-child-swing.json'), JSON.stringify(result.measurements, null, 2));
  for (const measurement of result.measurements) expect(measurement.backwards).toBeLessThan(109 * measurement.scale * .03);
});
