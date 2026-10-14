import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { ANIMAL_DIMENSIONS, DIRECTIONS } from '../src/appearance.ts';
import { SWIM_CYCLE } from '../src/animation-frames.ts';

// Register complete bird drawings. PNG pixels are never changed. Every heading
// shares the species' physical height, with one scale throughout its cycle.
export async function buildBirdAtlas({ inspectOnly = false } = {}) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true });
  const atlas = { textures: [] };
  try {
    const page = await browser.newPage();
    for (const species of ['duck', 'gull', 'coot']) {
      const image = `bird-${species}-swimming.png`;
      const png = 'data:image/png;base64,' + (await fs.readFile(`public/art/${image}`)).toString('base64');
      const inspected = await page.evaluate(async ({ png, species }) => {
        async function decode(png) {
          const image = new Image(); image.src = png; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
          const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0);
          return { width: canvas.width, height: canvas.height, pixels: context.getImageData(0, 0, canvas.width, canvas.height).data };
        }
        const { width, height, pixels } = await decode(png);
        const solid = index => pixels[index * 4 + 3] >= 128;
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
        if (boxes.length !== 32) throw new Error(`${species}: expected 32 complete silhouettes, found ${boxes.length}`);
        boxes.sort((a, b) => a.top + a.bottom - b.top - b.bottom);
        for (let row = 0; row < 4; row++) {
          const start = row * 8;
          boxes.splice(start, 8, ...boxes.slice(start, start + 8).sort((a, b) => a.left - b.left));
        }
        for (const box of boxes) {
          // Register at the center of the lower body, unaffected by beak or tail tips.
          const body = [], h = box.bottom - box.top;
          for (let y = Math.floor(box.top + h * .55); y < box.top + h * .9; y++) {
            for (let x = box.left; x < box.right; x++) if (solid(y * width + x)) body.push(x);
          }
          body.sort((a, b) => a - b); box.axis = body[Math.floor(body.length / 2)];
          box.waterline = box.bottom;
          box.frame = { x: Math.max(0, box.left - 2), y: Math.max(0, box.top - 2),
            w: Math.min(width, box.right + 2) - Math.max(0, box.left - 2),
            h: Math.min(height, box.bottom + 2) - Math.max(0, box.top - 2) };
        }
        return { width, height, boxes };
      }, { png, species });
      const frames = [];
      let maxVariation = 0;
      for (const [column, direction] of DIRECTIONS.entries()) {
        const poses = [0, 1, 2, 3].map(row => inspected.boxes[row * 8 + column]);
        const heights = poses.map(box => box.bottom - box.top).sort((a, b) => a - b);
        const referenceHeight = (heights[1] + heights[2]) / 2 / ANIMAL_DIMENSIONS[species].height;
        const waterY = referenceHeight * .2;
        const sourceSize = {
          w: 2 * Math.ceil(Math.max(...poses.map(box => Math.max(box.axis - box.frame.x, box.frame.x + box.frame.w - box.axis)))) + 8,
          h: 2 * Math.ceil(Math.max(...poses.map(box => Math.max(box.waterline - box.frame.y - waterY, box.frame.y + box.frame.h - box.waterline + waterY)))) + 8,
        };
        for (const dimension of ['width', 'height']) {
          const values = poses.map(box => dimension === 'width' ? box.right - box.left : box.bottom - box.top);
          maxVariation = Math.max(maxVariation, (Math.max(...values) - Math.min(...values)) / (values.reduce((a, b) => a + b) / 4));
        }
        for (const [row, box] of poses.entries()) {
          const frame = box.frame;
          const x = Math.round(sourceSize.w / 2 - (box.axis - frame.x));
          const y = Math.round(sourceSize.h / 2 + waterY - (box.waterline - frame.y));
          frames.push({ filename: `${species}-${direction}-${SWIM_CYCLE[row]}`, frame, rotated: false, trimmed: true,
            spriteSourceSize: { x, y, w: frame.w, h: frame.h }, sourceSize, referenceHeight,
            bodyBounds: { x: x + box.left - frame.x, y: y + box.top - frame.y, w: box.right - box.left, h: box.bottom - box.top },
            waterline: { x: x + box.axis - frame.x, y: y + box.waterline - frame.y },
          });
        }
      }
      atlas.textures.push({ image, size: { w: inspected.width, h: inspected.height }, frames });
      console.log(`${species}: 32 whole drawings, one scale per heading, largest body-size variation ${(100 * maxVariation).toFixed(1)}%`);
    }
  } finally { await browser.close(); }
  if (!inspectOnly) await fs.writeFile('public/art/bird-swimmers-animation.json', JSON.stringify(atlas, null, 2) + '\n');
  return atlas;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await buildBirdAtlas({ inspectOnly: process.argv.includes('--inspect') });
