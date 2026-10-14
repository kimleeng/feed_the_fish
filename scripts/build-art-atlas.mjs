import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

// Inspect alpha to package generated art. The PNG is read without editing its pixels.
const type = process.argv[2];
if (!['fish', 'machine', 'hand', 'observers'].includes(type)) throw new Error('Usage: node scripts/build-art-atlas.mjs fish|machine|hand|observers');
if (type === 'hand') {
  const sources = [
    { image: 'right-hand-cup.png', names: ['rest', 'toss-windup', 'overhand-windup', 'spread-ready', 'spread-windup', 'recover', 'empty'] },
    { image: 'right-hand-quick.png', names: ['toss-release'] },
    { image: 'right-hand-overhand.png', names: ['overhand-release', 'overhand-follow'] },
    { image: 'right-hand-spread.png', names: ['spread-release', 'spread-follow'] },
  ];
  const inputs = await Promise.all(sources.map(async source => ({ ...source,
    png: 'data:image/png;base64,' + (await fs.readFile(`public/art/${source.image}`)).toString('base64'),
  })));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true });
  let textures;
  try {
    const page = await browser.newPage();
    textures = await page.evaluate(async inputs => {
      const textures = [];
      for (const input of inputs) {
        const image = new Image(); image.src = input.png; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        let left = canvas.width; let top = canvas.height; let right = 0; let bottom = 0;
        for (let i = 0; i < canvas.width * canvas.height; i++) if (data[i * 4 + 3] >= 128) {
          const x = i % canvas.width; const y = Math.floor(i / canvas.width);
          left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
        }
        if (right <= left || bottom <= top) throw new Error(`Empty hand image: ${input.image}`);
        const x = Math.max(0, left - 2); const y = Math.max(0, top - 2);
        const w = Math.min(canvas.width, right + 2) - x; const h = Math.min(canvas.height, bottom + 2) - y;
        textures.push({ image: input.image, format: 'RGBA8888', size: { w: canvas.width, h: canvas.height }, scale: '1',
          frames: input.names.map(filename => ({ filename, frame: { x, y, w, h }, rotated: false, trimmed: true,
            spriteSourceSize: { x, y, w, h }, sourceSize: { w: canvas.width, h: canvas.height }, pivot: { x: 0.42, y: 0.24 },
          })),
        });
      }
      return textures;
    }, inputs);
  } finally { await browser.close(); }
  await fs.writeFile('public/art/right-arm-throws.json', JSON.stringify({ textures, meta: { handedness: 'right' } }, null, 2) + '\n');
  console.log('Packaged 12 named right-arm poses from four source cutouts without changing PNG pixels.');
  process.exit(0);
}
const basename = { fish: 'fish-swimmers', machine: 'scene-machine', observers: 'garden-observers' }[type];
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
      const expected = type === 'observers' ? 24 : 48;
      if (boxes.length !== expected) throw new Error(`Expected ${expected} ${type} silhouettes; found ${boxes.length}. Inspect the generated art before packaging.`);
      boxes.sort((a, b) => a.top + a.bottom - b.top - b.bottom);
      const columns = type === 'observers' ? 4 : 8;
      for (let row = 0; row < expected / columns; row++) {
        const ordered = boxes.slice(row * columns, row * columns + columns).sort((a, b) => a.left + a.right - b.left - b.right);
        boxes.splice(row * columns, columns, ...ordered);
      }
    }
    return { width, height, boxes };
  }, { src, type });
} finally { await browser.close(); }

const frames = {};
const directions = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
const observerSize = { w: Math.max(...inspected.boxes.map(box => box.right - box.left)) + 8,
  h: Math.max(...inspected.boxes.map(box => box.bottom - box.top)) + 8 };
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
  const name = type === 'fish' ? `${['koi', 'carp', 'minnow'][Math.floor(index / 16)]}-${directions[index % 8]}-${Math.floor(index / 8) % 2}`
    : type === 'observers' ? `observer-${index < 12 ? 'adult' : 'kid'}-${Math.floor(index / 4) % 3}-${['walk-0', 'walk-1', 'walk-2', 'watch'][index % 4]}` : 'machine';
  const size = type === 'fish' ? { w: 224, h: 224 } : type === 'observers' ? observerSize : { w, h };
  const source = { x: Math.floor((size.w - w) / 2), y: type === 'observers' ? size.h - h : Math.floor((size.h - h) / 2) };
  if (source.x < 0 || source.y < 0 || source.x + w > size.w || source.y + h > size.h) {
    throw new Error(`${name} crosses its grid cell. Correct sprite spacing before packaging.`);
  }
  frames[name] = {
    frame: { x, y, w, h }, rotated: false, trimmed: type !== 'machine',
    spriteSourceSize: { ...source, w, h }, sourceSize: size,
  };
}
await fs.writeFile(`public/art/${basename}.json`, JSON.stringify({ frames, meta: {
  image: `${basename}.png`, format: 'RGBA8888', size: { w: inspected.width, h: inspected.height }, scale: '1',
} }, null, 2) + '\n');
console.log(`Packaged ${Object.keys(frames).length} ${type} frames without changing PNG pixels.`);
