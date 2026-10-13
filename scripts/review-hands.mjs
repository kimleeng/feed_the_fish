import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve(process.argv[2] || 'test-results/hand-review');
await fs.mkdir(output, { recursive: true });
const atlas = JSON.parse(await fs.readFile('public/art/right-arm-throws.json', 'utf8'));
const entries = {};
const images = [];
for (const texture of atlas.textures) {
  images.push({ name: texture.image, size: texture.size,
    png: 'data:image/png;base64,' + (await fs.readFile(`public/art/${texture.image}`)).toString('base64') });
  for (const frame of texture.frames) {
    if (entries[frame.filename]) throw new Error(`Duplicate hand pose: ${frame.filename}`);
    entries[frame.filename] = { ...frame, image: texture.image, imageSize: texture.size };
  }
}
const names = ['rest', 'toss-windup', 'toss-release', 'overhand-windup', 'overhand-release', 'overhand-follow',
  'spread-ready', 'spread-windup', 'spread-release', 'spread-follow', 'recover', 'empty'];
if (Object.keys(entries).length !== 12 || names.some(name => !entries[name])) throw new Error('Missing right-arm poses.');
for (const [index, name] of names.entries()) {
  const { frame, spriteSourceSize: source, sourceSize: size, imageSize } = entries[name];
  if (frame.x < 0 || frame.y < 0 || frame.x + frame.w > imageSize.w || frame.y + frame.h > imageSize.h ||
      source.x < 0 || source.y < 0 || source.x + frame.w > size.w || source.y + frame.h > size.h ||
      source.w !== frame.w || source.h !== frame.h) throw new Error(`Invalid bounds for ${name}`);
  for (const previous of names.slice(0, index)) {
    if (entries[previous].image !== entries[name].image) continue;
    const other = entries[previous].frame;
    // Several motion stages intentionally reuse the same checked hand drawing.
    if (frame.x === other.x && frame.y === other.y && frame.w === other.w && frame.h === other.h) continue;
    if (Math.min(frame.x + frame.w, other.x + other.w) > Math.max(frame.x, other.x) &&
        Math.min(frame.y + frame.h, other.y + other.h) > Math.max(frame.y, other.y)) throw new Error(`Overlapping poses: ${name}, ${previous}`);
  }
}
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1500 } });
  for (const detail of [true, false]) {
    await page.setContent(`<style>body{margin:24px;background:#f5f2e9;color:#334c40;font:14px monospace}h1{font:26px Georgia}main{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}article{background:#dde6df;padding:12px;text-align:center;border:1px solid #b4c5b7}canvas{display:block;margin:auto;width:300px;image-rendering:pixelated}p{margin:8px 0 0}</style><h1>${detail ? 'Hand details: check four fingers and one thumb in every pose' : 'Right-arm poses: wrist joins and long sleeves'}</h1><main></main>`);
    await page.evaluate(async ({ entries, images, names, detail }) => {
      const loaded = {};
      for (const source of images) {
        const image = new Image(); image.src = source.png; await image.decode();
        if (image.width !== source.size.w || image.height !== source.size.h) throw new Error('PNG and atlas dimensions differ.');
        loaded[source.name] = image;
      }
      for (const name of names) {
        const entry = entries[name];
        const canvas = document.createElement('canvas'); canvas.width = entry.sourceSize.w;
        canvas.height = detail ? Math.ceil(entry.sourceSize.h * 0.49) : entry.sourceSize.h;
        const context = canvas.getContext('2d'); context.imageSmoothingEnabled = false;
        const frame = entry.frame; const source = entry.spriteSourceSize;
        context.drawImage(loaded[entry.image], frame.x, frame.y, frame.w, frame.h, source.x, source.y, source.w, source.h);
        const card = document.createElement('article'); const label = document.createElement('p'); label.textContent = name;
        card.append(canvas, label); document.querySelector('main').append(card);
      }
    }, { entries, images, names, detail });
    await page.screenshot({ path: path.join(output, detail ? 'hand-details.png' : 'right-arm-poses.png'), fullPage: true });
  }
} finally { await browser.close(); }
console.log(`Validated 12 right-arm stages from four isolated drawings; inspect digit counts in ${output}/hand-details.png.`);
