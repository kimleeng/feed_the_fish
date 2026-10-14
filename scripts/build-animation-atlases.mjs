import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { ANIMATED_ATLASES, WALK_CYCLE } from '../src/animation-frames.ts';
import { buildBirdAtlas } from './build-bird-atlas.mjs';

// Package the original drawings and generated in-betweens as multi-image atlases.
// Only atlas metadata is written: neither source PNG is resampled or repainted.
const inspectOnly = process.argv.includes('--inspect');
const directions = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
const throwNames = ['toss', 'overhand', 'spread'].flatMap(motion =>
  ['anticipate', 'drive', 'settle', 'return'].map(stage => `${motion}-${stage}`));
const employeeNames = [0, 1, 2, 3].map(phase => `walk-${phase}-between`).concat(
  ['open-reach', 'open-return', 'lift-half', 'lift-ready', 'lift-tip', 'close-lower', 'close-reach', 'close-return']);
const configs = ANIMATED_ATLASES.filter(name => name !== 'bird-swimmers').map(name => ({ name, asset: `${name}-inbetweens`, body: !name.includes('swim'),
  columns: name.includes('swim') ? 8 : 4,
  names: name === 'dock-thrower' ? throwNames : name === 'garden-employee' ? employeeNames
    : name === 'garden-observers' ? ['adult', 'kid'].flatMap(age => [0, 1, 2].flatMap(look =>
      [0, 1, 2, 3].map(phase => `observer-${age}-${look}-walk-${phase}-between`)))
      : (name === 'fish-swimmers' ? ['koi', 'carp', 'minnow'] : name === 'bird-swimmers' ? ['duck', 'gull', 'coot'] : ['musk-turtle'])
        .flatMap(species => [2, 3].flatMap(stroke => directions.map(direction => `${species}-${direction}-${stroke}`))),
}));
// The young carp's last phase was drawn separately to keep all eight views complete.
const fishConfig = configs.find(config => config.name === 'fish-swimmers');
const youngNames = fishConfig.names.splice(40);
configs.push({ name: 'fish-swimmers', asset: 'fish-young-inbetweens', body: false, columns: 4, names: youngNames });
// Correct the weight-transfer, passing and toe-off drawings. Keep the original
// heel-contact poses to preserve the established stride length and proportions.
for (let look = 0; look < 3; look++) {
  configs.push({ name: 'garden-observers', asset: `observer-adult-${look}-walk`, body: true, walking: true,
    columns: 4, names: WALK_CYCLE.map(pose => `observer-adult-${look}-${pose}`) });
}
configs.push({ name: 'garden-employee', asset: 'employee-walk', body: true, walking: true,
  columns: 4, names: [...WALK_CYCLE] });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true });
const inspections = {};
try {
  const page = await browser.newPage();
  for (const config of configs) {
    let bytes;
    try { bytes = await fs.readFile(`public/art/${config.asset}.png`); }
    catch (error) { if (inspectOnly && error.code === 'ENOENT') continue; throw error; }
    const png = 'data:image/png;base64,' + bytes.toString('base64');
    inspections[config.asset] = await page.evaluate(async ({ png, config }) => {
      const image = new Image(); image.src = png; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
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
        if (queue.length > 300) boxes.push({ left, top, right, bottom });
      }
      if (boxes.length !== config.names.length) throw new Error(`${config.name}: expected ${config.names.length} silhouettes, found ${boxes.length}`);
      boxes.sort((a, b) => a.top + a.bottom - b.top - b.bottom);
      for (let row = 0; row < boxes.length / config.columns; row++) {
        const start = row * config.columns;
        boxes.splice(start, config.columns, ...boxes.slice(start, start + config.columns).sort((a, b) => a.left - b.left));
      }
      for (const box of boxes) {
        const h = box.bottom - box.top;
        const runs = []; let run;
        for (let x = box.left; x <= box.right; x++) {
          let pixels = 0, sole = 0;
          for (let y = box.bottom - Math.ceil(h * 0.08); y < box.bottom; y++) if (x < box.right && solid(y * width + x)) {
            pixels++; sole = y + 1;
          }
          if (pixels) {
            run ??= { left: x, right: x, count: 0, sole: 0 };
            run.right = x; run.count += pixels; run.sole = Math.max(run.sole, sole);
          } else if (run) { runs.push(run); run = undefined; }
        }
        box.feet = runs.filter(run => run.count > 10).sort((a, b) => b.count - a.count).slice(0, 2)
          .map(run => ({ x: (run.left + run.right) / 2, y: run.sole })).sort((a, b) => a.x - b.x);
        const hips = [];
        for (let y = Math.floor(box.bottom - h * 0.46); y < box.bottom - h * 0.36; y++) {
          for (let x = box.left; x < box.right; x++) if (solid(y * width + x)) hips.push(x);
        }
        hips.sort((a, b) => a - b);
        box.axis = config.name === 'dock-thrower' ? box.feet.reduce((sum, foot) => sum + foot.x, 0) / box.feet.length : hips[Math.floor(hips.length / 2)];
      }
      return { width, height, boxes };
    }, { png, config });
  }
} finally { await browser.close(); }
await fs.writeFile('/tmp/animation-boxes.json', JSON.stringify(inspections, null, 2));
await buildBirdAtlas({ inspectOnly });
if (inspectOnly) {
  for (const config of configs) if (inspections[config.asset]) console.log(config.asset, inspections[config.asset].boxes.map((box, index) => ({ name: config.names[index], ...box })));
  process.exit(0);
}

const pins = JSON.parse(await fs.readFile('public/art/animation-pins.json', 'utf8'));
const throwOffsets = {};
const atlases = {};
for (const config of configs) {
  const base = JSON.parse(await fs.readFile(`public/art/${config.name}.json`, 'utf8'));
  const inspected = inspections[config.asset];
  const baseFrames = Object.entries(base.frames).map(([filename, entry]) => {
    const reference = config.name === 'dock-thrower' ? base.frames.empty
      : config.name === 'garden-employee' ? base.frames['walk-0']
        : config.name === 'garden-observers' ? base.frames[filename.replace(/-(walk-\d|watch)$/, '-walk-0')] : null;
    return { filename, ...entry, referenceHeight: reference ? reference.frame.h : entry.sourceSize.h,
      ...(config.body ? { feet: base.meta.anchors[filename].feet } : {}),
      ...(config.name === 'dock-thrower' ? { hand: base.meta.hands[filename] } : {}),
      ...(config.name === 'garden-employee' && filename === 'pour' ? { pour: base.meta.pour } : {}),
    };
  });
  const size = { w: Math.ceil(Math.max(...inspected.boxes.map(box => Math.max(box.axis - box.left, box.right - box.axis))) * 2) + 12,
    h: Math.max(...inspected.boxes.map(box => box.bottom - box.top)) + 8 };
  const extraFrames = config.names.map((filename, index) => {
    const box = inspected.boxes[index];
    const frame = { x: box.left, y: box.top, w: box.right - box.left, h: box.bottom - box.top };
    let sourceSize, source, referenceHeight;
    if (config.body) {
      const start = index - index % 4;
      const heights = inspected.boxes.slice(start, start + 4)
        .map(box => box.bottom - box.top).sort((a, b) => a - b);
      referenceHeight = heights[Math.floor(heights.length / 2)];
      sourceSize = size;
      source = { x: Math.round(size.w / 2 - (box.axis - frame.x)), y: size.h - frame.h };
    } else {
      const reference = base.frames[filename.replace(/-[23]$/, '-0')];
      referenceHeight = reference.sourceSize.h * Math.max(frame.w, frame.h) / Math.max(reference.frame.w, reference.frame.h);
      const extent = Math.ceil(Math.max(referenceHeight, frame.w + 4, frame.h + 4));
      sourceSize = { w: extent, h: extent };
      source = { x: Math.floor((extent - frame.w) / 2), y: Math.floor((extent - frame.h) / 2) };
    }
    const entry = { filename, frame, rotated: false, trimmed: true,
      spriteSourceSize: { ...source, w: frame.w, h: frame.h }, sourceSize, referenceHeight };
    if (config.body) entry.feet = box.feet.map(foot => ({ x: source.x + foot.x - frame.x, y: source.y + foot.y - frame.y }));
    const pin = config.name === 'dock-thrower' ? pins.thrower[filename] : null;
    if (pin) {
      if (pin.x < box.left || pin.x >= box.right || pin.y < box.top || pin.y >= box.bottom) throw new Error(`Pin outside ${filename}`);
      const local = { x: source.x + pin.x - frame.x, y: source.y + pin.y - frame.y };
      if (config.name === 'dock-thrower') {
        if (box.feet.length !== 2) throw new Error(`${filename} needs two planted shoes`);
        entry.hand = local;
        throwOffsets[filename] = { x: (local.x - size.w / 2) * 145 / referenceHeight, y: (local.y - size.h) * 145 / referenceHeight };
      } else entry.pour = local;
    } else if (config.name === 'dock-thrower') throw new Error(`Missing throwing hand pin for ${filename}`);
    return entry;
  });
  const atlas = atlases[config.name] ??= { textures: [{ image: `${config.name}.png`, size: base.meta.size, frames: baseFrames }] };
  const selectedFrames = config.walking ? extraFrames.filter((_, index) => index % 4 !== 0) : extraFrames;
  if (config.walking) {
    const replaced = new Set(selectedFrames.map(frame => frame.filename));
    for (const texture of atlas.textures) texture.frames = texture.frames.filter(frame => !replaced.has(frame.filename));
  }
  atlas.textures.push({ image: `${config.asset}.png`, size: { w: inspected.width, h: inspected.height }, frames: selectedFrames });
}
for (const [name, atlas] of Object.entries(atlases)) {
  atlas.textures = atlas.textures.filter(texture => texture.frames.length > 0);
  await fs.writeFile(`public/art/${name}-animation.json`, JSON.stringify(atlas, null, 2) + '\n');
  console.log(`${name}: ${atlas.textures.reduce((sum, texture) => sum + texture.frames.length, 0)} drawings`);
}
await fs.writeFile('src/thrower-inbetweens.ts', '// Generated by scripts/build-animation-atlases.mjs from annotated hand positions.\n' +
  'export const THROWER_INTERMEDIATE_HANDS = ' + JSON.stringify(throwOffsets, null, 2) + ';\n');
