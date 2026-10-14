import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

// Package complete piles from the generated 5×5 sheet without editing PNG pixels.
const png = 'data:image/png;base64,' + (await fs.readFile('public/art/pellet-stock.png')).toString('base64');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true });
let inspected;
try {
  const page = await browser.newPage();
  inspected = await page.evaluate(async png => {
    const image = new Image(); image.src = png; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    // Use the clear gutters to keep every loose grain with its pile. Connected
    // component detection would drop small, separate pellets at low stock.
    const bands = occupied => {
      const gaps = [];
      let start = -1, seenFood = false;
      for (let i = 0; i < occupied.length; i++) {
        if (occupied[i]) {
          if (start >= 0) gaps.push({ start, end: i });
          start = -1; seenFood = true;
        } else if (seenFood && start < 0) start = i;
      }
      const gutters = gaps.filter(gap => gap.end - gap.start >= 6)
        .sort((a, b) => b.end - b.start - (a.end - a.start)).slice(0, 4);
      if (gutters.length !== 4) throw new Error('Expected five separated piles in every row and five separated rows. Inspect the artwork.');
      const cuts = [0, ...gutters.map(gap => Math.floor((gap.start + gap.end) / 2)).sort((a, b) => a - b), occupied.length];
      return cuts.slice(0, -1).map((start, index) => ({ start, end: cuts[index + 1] }));
    };
    const occupiedRows = new Uint8Array(image.height);
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
      if (data[(y * image.width + x) * 4 + 3] >= 128) occupiedRows[y] = 1;
    }
    const boxes = [];
    for (const row of bands(occupiedRows)) {
      const occupiedColumns = new Uint8Array(image.width);
      for (let y = row.start; y < row.end; y++) for (let x = 0; x < image.width; x++) {
        if (data[(y * image.width + x) * 4 + 3] >= 128) occupiedColumns[x] = 1;
      }
      for (const column of bands(occupiedColumns)) {
        let left = column.end, right = column.start, top = row.end, bottom = row.start, area = 0;
        for (let y = row.start; y < row.end; y++) for (let x = column.start; x < column.end; x++) {
          const alpha = data[(y * image.width + x) * 4 + 3];
          if (alpha < 32) continue;
          left = Math.min(left, x); right = Math.max(right, x + 1);
          top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
          area += alpha / 255;
        }
        if (area < 100) throw new Error('Every stock level needs a visible pellet pile.');
        if (left < column.start + 2 || right > column.end - 2 || top < row.start + 2 || bottom > row.end - 2) {
          throw new Error('A pellet touches its cell boundary. Re-space the art instead of cutting a pellet.');
        }
        boxes.push({ x: left - 2, y: top - 2, w: right - left + 4, h: bottom - top + 4, area });
      }
    }
    for (const [index, box] of boxes.entries()) {
      box.sourceCell = index + 1;
      if (boxes.slice(0, index).some(other => Math.min(box.x + box.w, other.x + other.w) > Math.max(box.x, other.x) &&
          Math.min(box.y + box.h, other.y + other.h) > Math.max(box.y, other.y))) {
        throw new Error('Pellet pile bounds overlap. Re-space the source art.');
      }
    }
    return { width: image.width, height: image.height, boxes };
  }, png);
} finally { await browser.close(); }

// Order by the amount of painted food, so a purchase always removes food.
inspected.boxes.sort((a, b) => a.area - b.area);
const size = { w: Math.max(...inspected.boxes.map(box => box.w)) + 4, h: Math.max(...inspected.boxes.map(box => box.h)) + 4 };
const frames = {}, piles = {};
for (const [index, { x, y, w, h, area, sourceCell }] of inspected.boxes.entries()) {
  const name = `stock-${index + 1}`;
  frames[name] = { frame: { x, y, w, h }, rotated: false, trimmed: true,
    spriteSourceSize: { x: Math.floor((size.w - w) / 2), y: size.h - h, w, h }, sourceSize: size };
  piles[name] = { sourceCell, paintedArea: Math.round(area) };
}
const meta = { image: 'pellet-stock.png', format: 'RGBA8888',
  size: { w: inspected.width, h: inspected.height }, scale: '1', piles };
await fs.writeFile('public/art/pellet-stock.json', JSON.stringify({ frames, meta }, null, 2) + '\n');
console.log(JSON.stringify({ frames: Object.keys(frames).length, sourceSize: size, piles }));
