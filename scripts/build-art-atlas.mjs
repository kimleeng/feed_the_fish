import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

// Inspect alpha to package generated art. The PNG is read without editing its pixels.
const type = process.argv[2];
if (!['fish', 'machine'].includes(type)) throw new Error('Usage: node scripts/build-art-atlas.mjs fish|machine');
const basename = type === 'fish' ? 'fish-swimmers' : 'scene-machine';
const filename = `public/art/${basename}.png`;
const src = 'data:image/png;base64,' + (await fs.readFile(filename)).toString('base64');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true });
let inspected;
try {
  const page = await browser.newPage();
  inspected = await page.evaluate(async ({ src, type }) => {
    const image = new Image(); image.src = src; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const width = canvas.width; const height = canvas.height;
    const solid = index => data[index * 4 + 3] >= 128;
    const boxes = [];
    if (type === 'machine') {
      let left = width; let top = height; let right = 0; let bottom = 0;
      for (let i = 0; i < width * height; i++) if (solid(i)) {
        const x = i % width; const y = Math.floor(i / width);
        left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
      }
      boxes.push({ left, top, right, bottom });
    } else {
      const visited = new Uint8Array(width * height);
      for (let i = 0; i < visited.length; i++) {
        if (visited[i] || !solid(i)) continue;
        const queue = [i]; visited[i] = 1; let count = 0;
        let left = width; let top = height; let right = 0; let bottom = 0;
        for (let cursor = 0; cursor < queue.length; cursor++) {
          const index = queue[cursor]; const x = index % width; const y = Math.floor(index / width); count++;
          left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
          const neighbors = [x > 0 ? index - 1 : -1, x + 1 < width ? index + 1 : -1,
            y > 0 ? index - width : -1, y + 1 < height ? index + width : -1];
          for (const next of neighbors) if (next >= 0 && !visited[next] && solid(next)) { visited[next] = 1; queue.push(next); }
        }
        if (count > 700) boxes.push({ left, top, right, bottom });
      }
      if (boxes.length !== 48) throw new Error(`Expected 48 fish silhouettes; found ${boxes.length}. Inspect the generated art before packaging.`);
      boxes.sort((a, b) => a.top + a.bottom - b.top - b.bottom);
      for (let row = 0; row < 6; row++) {
        const ordered = boxes.slice(row * 8, row * 8 + 8).sort((a, b) => a.left + a.right - b.left - b.right);
        boxes.splice(row * 8, 8, ...ordered);
      }
    }
    return { width, height, boxes };
  }, { src, type });
} finally { await browser.close(); }

const frames = {};
const directions = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
for (let index = 0; index < inspected.boxes.length; index++) {
  const box = inspected.boxes[index];
  const x = Math.max(0, box.left - 2); const y = Math.max(0, box.top - 2);
  const w = Math.min(inspected.width, box.right + 2) - x; const h = Math.min(inspected.height, box.bottom + 2) - y;
  if (type === 'fish' && (w > 224 || h > 224)) throw new Error('Fish exceeds the shared 224px source size.');
  for (const entry of Object.values(frames)) {
    const previous = entry.frame;
    if (Math.min(x + w, previous.x + previous.w) > Math.max(x, previous.x) &&
        Math.min(y + h, previous.y + previous.h) > Math.max(y, previous.y)) throw new Error('Generated frames overlap; inspect spacing before packaging.');
  }
  const name = type === 'fish' ? `${['koi', 'carp', 'minnow'][Math.floor(index / 16)]}-${directions[index % 8]}-${Math.floor(index / 8) % 2}` : 'machine';
  const size = type === 'fish' ? { w: 224, h: 224 } : { w, h };
  frames[name] = {
    frame: { x, y, w, h }, rotated: false, trimmed: type === 'fish',
    spriteSourceSize: { x: Math.floor((size.w - w) / 2), y: Math.floor((size.h - h) / 2), w, h }, sourceSize: size,
  };
}
await fs.writeFile(`public/art/${basename}.json`, JSON.stringify({ frames, meta: {
  image: `${basename}.png`, format: 'RGBA8888', size: { w: inspected.width, h: inspected.height }, scale: '1',
} }, null, 2) + '\n');
console.log(`Packaged ${Object.keys(frames).length} ${type} frames without changing PNG pixels.`);
