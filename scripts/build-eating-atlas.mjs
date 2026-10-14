import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { ANIMAL_DIMENSIONS, DIRECTIONS, POND_ART_DEPTH_SCALE } from '../src/appearance.ts';

// Register whole authored poses without repainting or deforming the source PNGs.
// Each heading shares one scale for the entire meal; birds keep their waterline,
// fish their body center, and surfaced turtle heads their submerged head anchor.
const configs = [
  ...['duck', 'gull', 'coot'].map(species => ({ image: `eating-${species}.png`, kind: 'bird',
    rows: ['bite', 'chew', 'swallow'].map(pose => ({ species, pose })) })),
  { image: 'eating-fish.png', kind: 'fish', rows: ['koi', 'carp', 'minnow'].flatMap(species =>
    ['bite', 'chew'].map(pose => ({ species, pose }))) },
  { image: 'eating-turtle.png', kind: 'turtle', rows: ['bite', 'chew', 'swallow'].map(pose => ({ species: 'musk-turtle', pose })) },
];
const originals = Object.fromEntries(await Promise.all(['fish-swimmers', 'bird-swimmers', 'turtle-swimmer'].map(async name =>
  [name, JSON.parse(await fs.readFile(`public/art/${name}-animation.json`, 'utf8'))])));
const atlas = { textures: [] };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true });
try {
  const page = await browser.newPage();
  for (const config of configs) {
    const png = 'data:image/png;base64,' + (await fs.readFile(`public/art/${config.image}`)).toString('base64');
    const base = originals[config.kind === 'bird' ? 'bird-swimmers' : config.kind === 'fish' ? 'fish-swimmers' : 'turtle-swimmer'];
    const baseTextures = await Promise.all(base.textures.map(async texture => ({ ...texture,
      png: 'data:image/png;base64,' + (await fs.readFile(`public/art/${texture.image}`)).toString('base64') })));
    const inspected = await page.evaluate(async ({ png, config, baseTextures, depthScale }) => {
      async function pixels(png) {
        const image = new Image(); image.src = png; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
        return { width: canvas.width, height: canvas.height, data: ctx.getImageData(0, 0, canvas.width, canvas.height).data };
      }
      const source = await pixels(png);
      const { width, height, data } = source;
      const solid = i => data[i * 4 + 3] >= 128;
      const visited = new Uint8Array(width * height), boxes = [];
      for (let i = 0; i < visited.length; i++) {
        if (visited[i] || !solid(i)) continue;
        const queue = [i]; visited[i] = 1;
        let left = width, right = 0, top = height, bottom = 0;
        for (let at = 0; at < queue.length; at++) {
          const pixel = queue[at], x = pixel % width, y = Math.floor(pixel / width);
          left = Math.min(left, x); right = Math.max(right, x + 1); top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
          for (const next of [x > 0 ? pixel - 1 : -1, x + 1 < width ? pixel + 1 : -1,
            y > 0 ? pixel - width : -1, y + 1 < height ? pixel + width : -1]) {
            if (next >= 0 && !visited[next] && solid(next)) { visited[next] = 1; queue.push(next); }
          }
        }
        if (queue.length > 200) boxes.push({ left, right, top, bottom });
      }
      if (boxes.length !== config.rows.length * 8) throw new Error(`${config.image}: expected ${config.rows.length * 8} complete poses, got ${boxes.length}`);
      boxes.sort((a, b) => a.top + a.bottom - b.top - b.bottom);
      for (let row = 0; row < config.rows.length; row++) boxes.splice(row * 8, 8, ...boxes.slice(row * 8, row * 8 + 8).sort((a, b) => a.left - b.left));
      function measure(source, box, bandHeight = box.bottom - box.top) {
        const points = [], body = [];
        let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
        for (let y = box.top; y < box.bottom; y++) for (let x = box.left; x < box.right; x++) {
          if (source.data[(y * source.width + x) * 4 + 3] < 128) continue;
          const px = x - box.left, py = (y - box.top) / depthScale;
          points.push({ x: px, y: py }); sx += px; sy += py; sxx += px * px; syy += py * py; sxy += px * py;
          if (y > box.bottom - bandHeight * .4 && y < box.bottom - bandHeight * .1) body.push(x);
        }
        const n = points.length;
        const angle = .5 * Math.atan2(2 * (sxy - sx * sy / n), sxx - sx * sx / n - (syy - sy * sy / n));
        const along = points.map(point => point.x * Math.cos(angle) + point.y * Math.sin(angle));
        body.sort((a, b) => a - b);
        return { length: Math.max(...along) - Math.min(...along) + 1,
          axis: body[Math.floor(body.length / 2)], bodyWidth: body.at(-1) - body[0] + 1 };
      }
      const reference = {};
      for (const texture of baseTextures) {
        const source = await pixels(texture.png);
        for (const entry of texture.frames) {
          if (!entry.filename.endsWith(config.kind === 'turtle' ? '-head' : '-0')) continue;
          const { x, y, w, h } = entry.frame;
          const box = { left: x, top: y, right: x + w, bottom: y + h };
          reference[entry.filename] = { ...entry, ...measure(source, box) };
        }
      }
      boxes.forEach((box, index) => {
        const species = config.rows[Math.floor(index / 8)].species;
        const heights = boxes.filter((_, i) => i % 8 === index % 8 && config.rows[Math.floor(i / 8)].species === species)
          .map(box => box.bottom - box.top);
        Object.assign(box, measure(source, box, Math.max(...heights)));
      });
      return { width, height, boxes, reference };
    }, { png, config, baseTextures, depthScale: POND_ART_DEPTH_SCALE });

    const frames = [];
    for (const species of new Set(config.rows.map(row => row.species))) for (const [column, direction] of DIRECTIONS.entries()) {
      const poses = config.rows.flatMap((row, index) => row.species === species ? [{ ...inspected.boxes[index * 8 + column], pose: row.pose }] : []);
      const base = inspected.reference[`${species}-${direction}-${config.kind === 'turtle' ? 'head' : '0'}`];
      const average = field => poses.reduce((sum, pose) => sum + pose[field], 0) / poses.length;
      const referenceHeight = config.kind === 'bird' ? base.referenceHeight * average('bodyWidth') / base.bodyWidth
        : average('length') / (config.kind === 'turtle' ? ANIMAL_DIMENSIONS[species].headLength : ANIMAL_DIMENSIONS[species].length);
      for (const box of poses) {
        const frame = { x: Math.max(0, box.left - 2), y: Math.max(0, box.top - 2),
          w: Math.min(inspected.width, box.right + 2) - Math.max(0, box.left - 2),
          h: Math.min(inspected.height, box.bottom + 2) - Math.max(0, box.top - 2) };
        const ox = config.kind === 'turtle' ? base.surfaceOffset.x * referenceHeight : 0;
        const oy = config.kind === 'turtle' ? base.surfaceOffset.y * referenceHeight : config.kind === 'bird' ? .2 * referenceHeight : 0;
        const anchorX = config.kind === 'bird' ? box.axis - frame.x : frame.w / 2;
        const anchorY = config.kind === 'bird' ? box.bottom - frame.y : frame.h / 2;
        const sourceSize = {
          w: 2 * Math.ceil(Math.max(Math.abs(ox - anchorX), Math.abs(ox + frame.w - anchorX))) + 8,
          h: 2 * Math.ceil(Math.max(Math.abs(oy - anchorY), Math.abs(oy + frame.h - anchorY))) + 8,
        };
        const x = sourceSize.w / 2 + ox - anchorX, y = sourceSize.h / 2 + oy - anchorY;
        frames.push({ filename: `${species}-${direction}-${box.pose}`, frame, rotated: false, trimmed: true,
          sourceSize, spriteSourceSize: { x, y, w: frame.w, h: frame.h }, referenceHeight,
          ...(config.kind === 'turtle' ? { surfaceOffset: base.surfaceOffset } : {}),
          ...(config.kind === 'bird' ? { waterline: { x: sourceSize.w / 2, y: sourceSize.h / 2 + oy } } : {}),
        });
      }
    }
    atlas.textures.push({ image: config.image, size: { w: inspected.width, h: inspected.height }, frames });
    console.log(`${config.image}: ${frames.length} complete feeding poses, shared scale per heading`);
  }
} finally { await browser.close(); }
await fs.writeFile('public/art/animal-eating-animation.json', JSON.stringify(atlas, null, 2) + '\n');
