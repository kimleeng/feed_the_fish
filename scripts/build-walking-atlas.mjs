import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { OBSERVER_DESIGNS } from '../src/observer-looks.ts';

// Package complete drawings. Approved source cycles receive one uniform scale;
// original PNGs remain unchanged and no body parts are cut or assembled.
const designs = [...OBSERVER_DESIGNS, { design: 'employee', watchingInSheet: false }];
const inspectOnly = process.argv.includes('--inspect');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true });
const atlas = { textures: [] };
const gait = {};
try {
  const page = await browser.newPage();
  for (const { design, watchingInSheet } of designs) {
    let calibration;
    try { calibration = JSON.parse(await fs.readFile(`art-source/walking/${design}.json`, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (calibration?.output) {
      const source = await fs.readFile(`art-source/walking/${design}-cycle.png`);
      const normalized = await page.evaluate(async ({ png, calibration }) => {
        const image = new Image(); image.src = png; await image.decode();
        const { cell, columns, frames, ground, height, output } = calibration;
        const scale = output.height / height;
        const canvas = document.createElement('canvas');
        canvas.width = columns * output.cell; canvas.height = Math.ceil(frames / columns) * output.cell;
        const context = canvas.getContext('2d');
        for (let i = 0; i < frames; i++) context.drawImage(image,
          i % columns * cell, Math.floor(i / columns) * cell, cell, cell,
          i % columns * output.cell + output.cell / 2 - cell / 2 * scale,
          Math.floor(i / columns) * output.cell + output.ground - ground * scale, cell * scale, cell * scale);
        return canvas.toDataURL().split(',')[1];
      }, { png: 'data:image/png;base64,' + source.toString('base64'), calibration });
      if (!inspectOnly) await fs.writeFile(`public/art/${design}-walking-smooth.png`, Buffer.from(normalized, 'base64'));
      const { cell, ground, height, output } = calibration, scale = output.height / height;
      calibration = { ...calibration, cell: output.cell, cyclePixels: calibration.cyclePixels * scale,
        poses: calibration.poses.map(pose => ({ ...pose, ...Object.fromEntries(
          ['supportFoot', 'nearFoot', 'farFoot', 'hip'].filter(key => pose[key]).map(key => [key, {
            x: output.cell / 2 + (pose[key].x - cell / 2) * scale,
            y: output.ground + (pose[key].y - ground) * scale,
          }])) })) };
    }
    let filename = `${design}-walking.png`;
    let count = watchingInSheet ? 9 : 8;
    let columns = watchingInSheet ? 3 : 4;
    let walkingFrames = 8;
    try {
      await fs.access(`public/art/${design}-walking-smooth.png`);
      filename = `${design}-walking-smooth.png`;
      walkingFrames = calibration?.frames ?? 16;
      count = walkingFrames + (watchingInSheet ? 1 : 0);
      columns = calibration?.columns ?? 4;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    let bytes;
    try { bytes = await fs.readFile(`public/art/${filename}`); }
    catch (error) { if (inspectOnly && error.code === 'ENOENT') continue; throw error; }
    const inspected = await page.evaluate(async ({ png, count, columns, cell }) => {
      const image = new Image(); image.src = png; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      const width = canvas.width, height = canvas.height;
      const solid = index => data[index * 4 + 3] >= 128;
      const visited = new Uint8Array(width * height), boxes = [];
      if (cell) {
        // A full frame may contain a small disconnected painted outline. Keep
        // the entire approved cell together rather than cutting a body part off.
        for (let i = 0; i < count; i++) {
          const x0 = i % columns * cell, y0 = Math.floor(i / columns) * cell;
          let left = width, top = height, right = 0, bottom = 0, painted = 0;
          for (let y = y0; y < y0 + cell; y++) for (let x = x0; x < x0 + cell; x++) if (solid(y * width + x)) {
            left = Math.min(left, x); right = Math.max(right, x + 1);
            top = Math.min(top, y); bottom = Math.max(bottom, y + 1); painted++;
          }
          if (painted < 300) throw new Error(`Missing complete pose ${i}`);
          boxes.push({ left, top, right, bottom, painted });
        }
      } else for (let index = 0; index < visited.length; index++) {
        if (visited[index] || !solid(index)) continue;
        const queue = [index]; visited[index] = 1;
        let left = width, top = height, right = 0, bottom = 0;
        for (let cursor = 0; cursor < queue.length; cursor++) {
          const pixel = queue[cursor], x = pixel % width, y = Math.floor(pixel / width);
          left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
          for (const next of [x > 0 ? pixel - 1 : -1, x + 1 < width ? pixel + 1 : -1,
            y > 0 ? pixel - width : -1, y + 1 < height ? pixel + width : -1]) {
            if (next >= 0 && !visited[next] && solid(next)) { visited[next] = 1; queue.push(next); }
          }
        }
        if (queue.length > 300) boxes.push({ left, top, right, bottom, painted: queue.length });
      }
      if (boxes.length !== count) throw new Error(`Expected ${count} complete silhouettes, found ${boxes.length}`);
      if (!cell) boxes.sort((a, b) => a.top + a.bottom - b.top - b.bottom);
      for (let row = 0; !cell && row < count / columns; row++) {
        const start = row * columns;
        boxes.splice(start, columns, ...boxes.slice(start, start + columns).sort((a, b) => a.left - b.left));
      }
      for (const box of boxes) {
        const h = box.bottom - box.top;
        // Whole-frame registration at the waist and lowest painted sole.
        const waist = [];
        for (let y = Math.floor(box.top + h * 0.52); y < box.top + h * 0.60; y++) {
          for (let x = box.left; x < box.right; x++) if (solid(y * width + x)) waist.push(x);
        }
        waist.sort((a, b) => a - b);
        box.axis = waist[Math.floor(waist.length / 2)];
        const runs = []; let run;
        for (let x = box.left; x <= box.right; x++) {
          let count = 0, sole = 0;
          for (let y = box.bottom - Math.ceil(h * 0.09); y < box.bottom; y++) if (x < box.right && solid(y * width + x)) {
            count++; sole = y + 1;
          }
          if (count) {
            run ??= { left: x, right: x, count: 0, sole: 0 };
            run.right = x; run.count += count; run.sole = Math.max(run.sole, sole);
          } else if (run) { runs.push(run); run = undefined; }
        }
        box.feet = runs.filter(run => run.count > 10).sort((a, b) => b.count - a.count).slice(0, 2)
          .map(run => ({ x: (run.left + run.right) / 2, y: run.sole })).sort((a, b) => a.x - b.x);
        // Include soft outline pixels around the entire silhouette.
        box.left = Math.max(0, box.left - 2); box.top = Math.max(0, box.top - 2);
        box.right = Math.min(width, box.right + 2);
      }
      return { width, height, boxes };
    }, { png: 'data:image/png;base64,' + bytes.toString('base64'), count, columns, cell: calibration?.cell });
    const heights = inspected.boxes.slice(0, walkingFrames).map(box => box.bottom - box.top).sort((a, b) => a - b);
    const referenceHeight = (heights[Math.floor((walkingFrames - 1) / 2)] + heights[Math.floor(walkingFrames / 2)]) / 2;
    if (calibration) inspected.boxes.forEach((box, i) => { box.axis = i % columns * calibration.cell + calibration.cell / 2; });
    const sourceSize = {
      w: Math.ceil(Math.max(...inspected.boxes.map(box => Math.max(box.axis - box.left, box.right - box.axis))) * 2) + 8,
      h: Math.max(...inspected.boxes.map(box => box.bottom - box.top)) + 8,
    };
    const frames = inspected.boxes.map((box, index) => {
      const frame = { x: box.left, y: box.top, w: box.right - box.left, h: box.bottom - box.top };
      const source = { x: Math.round(sourceSize.w / 2 - (box.axis - box.left)), y: sourceSize.h - frame.h };
      const measured = calibration?.poses[index];
      const point = measured ? { x: index % columns * calibration.cell + measured.supportFoot.x,
        y: Math.floor(index / columns) * calibration.cell + measured.supportFoot.y } : undefined;
      const landmarks = measured ? Object.fromEntries(['nearFoot', 'farFoot', 'hip'].filter(key => measured[key]).map(key => [key, {
        x: source.x + index % columns * calibration.cell + measured[key].x - frame.x,
        y: source.y + Math.floor(index / columns) * calibration.cell + measured[key].y - frame.y,
      }])) : {};
      return { filename: `${design}-${index === walkingFrames ? 'watch' : `step-${index}`}`, frame, rotated: false, trimmed: true,
        spriteSourceSize: { ...source, w: frame.w, h: frame.h }, sourceSize, referenceHeight,
        feet: box.feet.map(foot => ({ x: source.x + foot.x - frame.x, y: source.y + foot.y - frame.y })),
        // Whole drawings register at their lowest painted sole. Restored source
        // poses can differ from the guide's ground by a few pixels; the ground
        // marker must use the same baseline as the sprite's bottom origin.
        ...(point ? { supportFoot: { x: source.x + point.x - frame.x, y: sourceSize.h },
          supportLeg: measured.supportLeg, posePhase: calibration.phases[index], ...landmarks,
          ...(measured.keyPose ? { keyPose: measured.keyPose } : {}) } : {}),
      };
    });
    const contacts = [0, Math.floor(walkingFrames / 2)].map(index => inspected.boxes[index].feet);
    if (!calibration && contacts.some(feet => feet.length !== 2)) throw new Error(`${design}: contact poses must show both complete shoes`);
    const distance = calibration ? calibration.cyclePixels / referenceHeight
      : contacts.reduce((sum, feet) => sum + feet[1].x - feet[0].x, 0) / referenceHeight;
    if (distance < 0.2 || distance > 1.2) throw new Error(`${design}: implausible cycle distance ${distance}`);
    gait[design] = { distance: Number(distance.toFixed(6)), frames: walkingFrames,
      phases: calibration?.phases ?? Array.from({ length: walkingFrames }, (_, i) => i / walkingFrames),
      ...(calibration?.seconds ? { seconds: calibration.seconds } : {}) };
    atlas.textures.push({ image: filename, size: { w: inspected.width, h: inspected.height }, frames });
    console.log(`${design}: ${frames.length} intact drawings, cycle distance ${distance.toFixed(3)} × height, height variation ${((heights.at(-1) - heights[0]) / referenceHeight * 100).toFixed(1)}%`);
  }
} finally { await browser.close(); }
if (!inspectOnly) {
  await fs.writeFile('public/art/people-walking.json', JSON.stringify(atlas, null, 2) + '\n');
  await fs.writeFile('src/walking-gait.ts', '// Generated from complete contact drawings by scripts/build-walking-atlas.mjs.\n' +
    'export const WALKING_GAIT = ' + JSON.stringify(gait, null, 2) + ' as const;\n');
} else await fs.writeFile('/tmp/whole-walking-inspection.json', JSON.stringify(atlas, null, 2) + '\n');
