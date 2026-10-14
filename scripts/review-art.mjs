import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

// Render the actual atlas cuts for visual review; do not alter the source artwork.
const output = path.resolve(process.argv[2] || 'test-results/art-review');
await fs.mkdir(output, { recursive: true });
const atlas = JSON.parse(await fs.readFile('public/art/fish-swimmers.json', 'utf8'));
const observers = JSON.parse(await fs.readFile('public/art/garden-observers.json', 'utf8'));
const directions = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
const expected = ['koi', 'carp', 'minnow'].flatMap(species => [0, 1].flatMap(stroke =>
  directions.map(direction => `${species}-${direction}-${stroke}`)));
if (Object.keys(atlas.frames).length !== 48 || expected.some(name => !atlas.frames[name])) {
  throw new Error('The carp atlas must contain all 48 named swim frames.');
}
const frames = Object.entries(atlas.frames);
const observerNames = ['adult', 'kid'].flatMap(age => [0, 1, 2].flatMap(look =>
  ['walk-0', 'walk-1', 'walk-2', 'watch'].map(pose => `observer-${age}-${look}-${pose}`)));
if (Object.keys(observers.frames).length !== 24 || observerNames.some(name => !observers.frames[name])) {
  throw new Error('The observer atlas must contain three adults and three kids, with all walking and watching poses.');
}
const observerFrames = Object.entries(observers.frames);
for (let i = 0; i < observerFrames.length; i++) {
  const [name, { frame, spriteSourceSize: source, sourceSize: size }] = observerFrames[i];
  if (frame.x < 0 || frame.y < 0 || frame.x + frame.w > observers.meta.size.w || frame.y + frame.h > observers.meta.size.h ||
      source.x < 0 || source.y < 0 || source.x + frame.w > size.w || source.y + frame.h > size.h ||
      source.w !== frame.w || source.h !== frame.h || source.y + source.h !== size.h) {
    throw new Error(`Invalid observer bounds or foot baseline for ${name}`);
  }
  for (let j = 0; j < i; j++) {
    const other = observerFrames[j][1].frame;
    if (Math.min(frame.x + frame.w, other.x + other.w) > Math.max(frame.x, other.x) &&
        Math.min(frame.y + frame.h, other.y + other.h) > Math.max(frame.y, other.y)) {
      throw new Error(`Observer cuts overlap: ${name}, ${observerFrames[j][0]}`);
    }
  }
}
for (let i = 0; i < frames.length; i++) {
  const [name, { frame, spriteSourceSize, sourceSize }] = frames[i];
  if (frame.x < 0 || frame.y < 0 || frame.x + frame.w > atlas.meta.size.w || frame.y + frame.h > atlas.meta.size.h ||
      spriteSourceSize.x < 0 || spriteSourceSize.y < 0 || spriteSourceSize.x + frame.w > sourceSize.w ||
      spriteSourceSize.y + frame.h > sourceSize.h || frame.w !== spriteSourceSize.w || frame.h !== spriteSourceSize.h) {
    throw new Error(`Invalid atlas bounds for ${name}`);
  }
  for (let j = 0; j < i; j++) {
    const other = frames[j][1].frame;
    if (Math.min(frame.x + frame.w, other.x + other.w) > Math.max(frame.x, other.x) &&
        Math.min(frame.y + frame.h, other.y + other.h) > Math.max(frame.y, other.y)) {
      throw new Error(`Atlas cuts overlap: ${name}, ${frames[j][0]}`);
    }
  }
}
const fish = 'data:image/png;base64,' + (await fs.readFile('public/art/fish-swimmers.png')).toString('base64');
const pond = 'data:image/png;base64,' + (await fs.readFile('public/art/pond.png')).toString('base64');
const observerImage = 'data:image/png;base64,' + (await fs.readFile('public/art/garden-observers.png')).toString('base64');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1320, height: 1200 } });
  const style = '<style>body{margin:24px;background:#f5f2e9;color:#334c40;font:13px monospace}h1{font:26px Georgia}main{display:grid;grid-template-columns:repeat(8,1fr);gap:8px}.frame{background:#dde6df;padding:8px;text-align:center;border:1px solid #b4c5b7}canvas{display:block;margin:auto;image-rendering:pixelated}.frame canvas{width:128px;height:128px}p{margin:6px 0 0}</style>';
  await page.setContent(style + '<h1>Fish atlas: every direction and tail stroke</h1><main></main>');
  await page.evaluate(async ({ atlas, fish }) => {
    const image = new Image(); image.src = fish; await image.decode();
    if (image.width !== atlas.meta.size.w || image.height !== atlas.meta.size.h) throw new Error('Atlas dimensions do not match the PNG.');
    for (const [name, entry] of Object.entries(atlas.frames)) {
      const card = document.createElement('div'); card.className = 'frame';
      const canvas = document.createElement('canvas');
      canvas.width = entry.sourceSize.w; canvas.height = entry.sourceSize.h;
      const context = canvas.getContext('2d'); context.imageSmoothingEnabled = false;
      const frame = entry.frame; const source = entry.spriteSourceSize;
      context.drawImage(image, frame.x, frame.y, frame.w, frame.h, source.x, source.y, source.w, source.h);
      const label = document.createElement('p'); label.textContent = name;
      card.append(canvas, label); document.querySelector('main').append(card);
    }
  }, { atlas, fish });
  await page.screenshot({ path: path.join(output, 'fish-frames.png'), fullPage: true });

  await page.setViewportSize({ width: 1120, height: 1200 });
  await page.setContent(style.replace('repeat(8,1fr)', 'repeat(4,1fr)')
    .replace('.frame canvas{width:128px;height:128px}', '.frame canvas{width:160px;height:auto}') +
    '<h1>Garden visitors: every actual walking and watching cut</h1><main></main>');
  await page.evaluate(async ({ atlas, png }) => {
    const image = new Image(); image.src = png; await image.decode();
    if (image.width !== atlas.meta.size.w || image.height !== atlas.meta.size.h) throw new Error('Observer PNG and atlas dimensions differ.');
    for (const [name, entry] of Object.entries(atlas.frames)) {
      const canvas = document.createElement('canvas'); canvas.width = entry.sourceSize.w; canvas.height = entry.sourceSize.h;
      const context = canvas.getContext('2d'); context.imageSmoothingEnabled = false;
      const frame = entry.frame; const source = entry.spriteSourceSize;
      context.drawImage(image, frame.x, frame.y, frame.w, frame.h, source.x, source.y, source.w, source.h);
      const card = document.createElement('div'); card.className = 'frame';
      const label = document.createElement('p'); label.textContent = name;
      card.append(canvas, label); document.querySelector('main').append(card);
    }
  }, { atlas: observers, png: observerImage });
  await page.screenshot({ path: path.join(output, 'observer-frames.png'), fullPage: true });

  await page.setViewportSize({ width: 1640, height: 1240 });
  await page.setContent(style.replace('repeat(8,1fr)', 'repeat(3,1fr)').replace('.frame canvas{width:128px;height:128px}', '') + '<h1>Garden review: all six image regions at full detail</h1><main></main>');
  await page.evaluate(async src => {
    const image = new Image(); image.src = src; await image.decode();
    for (let row = 0; row < 2; row++) {
      for (let column = 0; column < 3; column++) {
        const x = Math.floor(column * image.width / 3); const y = Math.floor(row * image.height / 2);
        const width = Math.floor((column + 1) * image.width / 3) - x;
        const height = Math.floor((row + 1) * image.height / 2) - y;
        const card = document.createElement('div'); card.className = 'frame';
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        const context = canvas.getContext('2d'); context.imageSmoothingEnabled = false;
        context.drawImage(image, x, y, width, height, 0, 0, width, height);
        const label = document.createElement('p'); label.textContent = `${row ? 'Foreground' : 'Background'} — ${['left', 'center', 'right'][column]}`;
        card.append(canvas, label); document.querySelector('main').append(card);
      }
    }
  }, pond);
  await page.screenshot({ path: path.join(output, 'garden-regions.png'), fullPage: true });
  console.log(`All 48 carp and 24 observer frames have valid, non-overlapping cuts. Art review images saved to ${output}`);
} finally {
  await browser.close();
}
