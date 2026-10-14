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
    const boxes = [], visited = new Uint8Array(image.width * image.height);
    for (let start = 0; start < visited.length; start++) {
      if (visited[start] || data[start * 4 + 3] < 32) continue;
      const queue = [start]; visited[start] = 1;
      let left = image.width, right = 0, top = image.height, bottom = 0, area = 0;
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const index = queue[cursor], x = index % image.width, y = Math.floor(index / image.width);
        left = Math.min(left, x); right = Math.max(right, x + 1);
        top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
        area += data[index * 4 + 3] / 255;
        for (const next of [x > 0 ? index - 1 : -1, x + 1 < image.width ? index + 1 : -1,
          y > 0 ? index - image.width : -1, y + 1 < image.height ? index + image.width : -1]) {
          if (next >= 0 && !visited[next] && data[next * 4 + 3] >= 32) { visited[next] = 1; queue.push(next); }
        }
      }
      if (area < 100) continue;
      if (left < 3 || right > image.width - 3 || top < 3 || bottom > image.height - 3) {
        throw new Error('A pile touches the image boundary. Re-space the art instead of cutting a pellet.');
      }
      boxes.push({ x: left - 2, y: top - 2, w: right - left + 4, h: bottom - top + 4, area });
    }
    if (boxes.length !== 25) throw new Error(`Expected 25 complete piles; found ${boxes.length}. Inspect the art before packaging.`);
    boxes.sort((a, b) => a.y + a.h / 2 - b.y - b.h / 2);
    for (let row = 0; row < 5; row++) {
      boxes.splice(row * 5, 5, ...boxes.slice(row * 5, row * 5 + 5).sort((a, b) => a.x - b.x));
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
