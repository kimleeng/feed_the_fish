import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { OBSERVER_DESIGNS } from '../src/observer-looks.ts';

// Package complete drawings. Only rectangles, alignment and stride metadata are
// written; every PNG remains unchanged, and no body parts are cut or assembled.
const designs = [...OBSERVER_DESIGNS, { design: 'employee', watchingInSheet: false }];
const inspectOnly = process.argv.includes('--inspect');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true });
const atlas = { textures: [] };
const gait = {};
try {
  const page = await browser.newPage();
  for (const { design, watchingInSheet } of designs) {
    const filename = `${design}-walking.png`;
    let bytes;
    try { bytes = await fs.readFile(`public/art/${filename}`); }
    catch (error) { if (inspectOnly && error.code === 'ENOENT') continue; throw error; }
    const inspected = await page.evaluate(async ({ png, watchingInSheet }) => {
      const image = new Image(); image.src = png; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      const width = canvas.width, height = canvas.height;
      const solid = index => data[index * 4 + 3] >= 128;
      const visited = new Uint8Array(width * height), boxes = [];
      for (let index = 0; index < visited.length; index++) {
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
      const count = watchingInSheet ? 9 : 8, columns = watchingInSheet ? 3 : 4;
      if (boxes.length !== count) throw new Error(`Expected ${count} complete silhouettes, found ${boxes.length}`);
      boxes.sort((a, b) => a.top + a.bottom - b.top - b.bottom);
      for (let row = 0; row < count / columns; row++) {
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
    }, { png: 'data:image/png;base64,' + bytes.toString('base64'), watchingInSheet });
    const heights = inspected.boxes.slice(0, 8).map(box => box.bottom - box.top).sort((a, b) => a - b);
    const referenceHeight = (heights[3] + heights[4]) / 2;
    const sourceSize = {
      w: Math.ceil(Math.max(...inspected.boxes.map(box => Math.max(box.axis - box.left, box.right - box.axis))) * 2) + 8,
      h: Math.max(...inspected.boxes.map(box => box.bottom - box.top)) + 8,
    };
    const frames = inspected.boxes.map((box, index) => {
      const frame = { x: box.left, y: box.top, w: box.right - box.left, h: box.bottom - box.top };
      const source = { x: Math.round(sourceSize.w / 2 - (box.axis - box.left)), y: sourceSize.h - frame.h };
      return { filename: `${design}-${index === 8 ? 'watch' : `step-${index}`}`, frame, rotated: false, trimmed: true,
        spriteSourceSize: { ...source, w: frame.w, h: frame.h }, sourceSize, referenceHeight,
        feet: box.feet.map(foot => ({ x: source.x + foot.x - frame.x, y: source.y + foot.y - frame.y })),
      };
    });
    const contacts = [0, 4].map(index => inspected.boxes[index].feet);
    if (contacts.some(feet => feet.length !== 2)) throw new Error(`${design}: contact poses must show both complete shoes`);
    const distance = contacts.reduce((sum, feet) => sum + feet[1].x - feet[0].x, 0) / referenceHeight;
    if (distance < 0.2 || distance > 1.2) throw new Error(`${design}: implausible cycle distance ${distance}`);
    gait[design] = { distance: Number(distance.toFixed(6)), frames: 8,
      phases: Array.from({ length: 8 }, (_, index) => index / 8) };
    atlas.textures.push({ image: filename, size: { w: inspected.width, h: inspected.height }, frames });
    console.log(`${design}: ${frames.length} intact drawings, cycle distance ${distance.toFixed(3)} × height, height variation ${((heights.at(-1) - heights[0]) / referenceHeight * 100).toFixed(1)}%`);
  }
} finally { await browser.close(); }
if (!inspectOnly) {
  await fs.writeFile('public/art/people-walking.json', JSON.stringify(atlas, null, 2) + '\n');
  await fs.writeFile('src/walking-gait.ts', '// Generated from complete contact drawings by scripts/build-walking-atlas.mjs.\n' +
    'export const WALKING_GAIT = ' + JSON.stringify(gait, null, 2) + ' as const;\n');
} else await fs.writeFile('/tmp/whole-walking-inspection.json', JSON.stringify(atlas, null, 2) + '\n');
