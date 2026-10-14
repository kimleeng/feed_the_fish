import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { ANIMAL_DIMENSIONS, POND_ART_DEPTH_SCALE } from '../src/appearance.ts';

// Source sheets have different resolutions and inconsistent directional crop
// lengths. Measure the whole silhouette along its own long axis, in pond-plane
// coordinates. A diagonal bounding box is not the animal's physical length.
// Only scale/registration metadata changes; all original drawings stay intact.
export async function registerSwimmerDimensions(atlases) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true });
  try {
    const page = await browser.newPage();
    for (const name of ['fish-swimmers', 'turtle-swimmer']) {
      const atlas = atlases[name];
      for (const texture of atlas.textures) {
        const png = 'data:image/png;base64,' + (await fs.readFile(`public/art/${texture.image}`)).toString('base64');
        const lengths = await page.evaluate(async ({ png, frames, depthScale }) => {
          const image = new Image(); image.src = png; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
          const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0);
          const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
          return frames.map(({ frame }) => {
            const points = [];
            let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
            for (let y = 0; y < frame.h; y++) for (let x = 0; x < frame.w; x++) {
              if (data[((frame.y + y) * canvas.width + frame.x + x) * 4 + 3] < 128) continue;
              const py = y / depthScale;
              points.push({ x, y: py }); sx += x; sy += py; sxx += x * x; syy += py * py; sxy += x * py;
            }
            if (points.length < 100) throw new Error('Missing swimmer silhouette');
            const count = points.length;
            const angle = .5 * Math.atan2(2 * (sxy - sx * sy / count), (sxx - sx * sx / count) - (syy - sy * sy / count));
            const dx = Math.cos(angle), dy = Math.sin(angle);
            let start = Infinity, end = -Infinity;
            for (const point of points) { const along = point.x * dx + point.y * dy; start = Math.min(start, along); end = Math.max(end, along); }
            return end - start + 1;
          });
        }, { png, frames: texture.frames, depthScale: POND_ART_DEPTH_SCALE });
        texture.frames.forEach((entry, index) => {
          const species = entry.filename.split('-').slice(0, -2).join('-');
          const dimensions = ANIMAL_DIMENSIONS[species];
          entry.referenceHeight = lengths[index] / (entry.filename.endsWith('-head') ? dimensions.headLength : dimensions.length);
        });
      }
      if (name === 'turtle-swimmer') {
        const base = JSON.parse(await fs.readFile('public/art/turtle-swimmer.json', 'utf8'));
        const frames = new Map(atlas.textures.flatMap(texture => texture.frames.map(entry => [entry.filename, entry])));
        for (const [direction, offset] of Object.entries(base.meta.headOffsets)) {
          const body = frames.get(`musk-turtle-${direction}-0`), head = frames.get(`musk-turtle-${direction}-head`);
          const bodyScale = base.frames[body.filename].sourceSize.h / body.referenceHeight;
          head.surfaceOffset = { x: offset.x * bodyScale, y: offset.y * bodyScale };
          // Keep the independently calibrated surfaced head over the submerged
          // head. Both sprites retain the animal's center as their world origin.
          const ox = head.surfaceOffset.x * head.referenceHeight, oy = head.surfaceOffset.y * head.referenceHeight;
          const extent = 2 * Math.ceil(Math.max(Math.abs(ox) + head.frame.w / 2, Math.abs(oy) + head.frame.h / 2)) + 8;
          head.sourceSize = { w: extent, h: extent };
          head.spriteSourceSize = { x: Math.round(extent / 2 + ox - head.frame.w / 2),
            y: Math.round(extent / 2 + oy - head.frame.h / 2), w: head.frame.w, h: head.frame.h };
        }
      }
    }
  } finally { await browser.close(); }
}
