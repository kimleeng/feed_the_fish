import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ANIMATED_ATLASES, WALK_CYCLE, SWIM_CYCLE } from '../src/animation-frames.ts';

export async function reviewAnimations(output, names = ANIMATED_ATLASES) {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true });
  let count = 0;
  try {
    const page = await browser.newPage({ viewport: { width: 1320, height: 1000 } });
    for (const name of names) {
      const atlas = JSON.parse(await fs.readFile(`public/art/${name}-animation.json`, 'utf8'));
      const seen = new Set();
      for (const texture of atlas.textures) {
        texture.png = 'data:image/png;base64,' + (await fs.readFile(`public/art/${texture.image}`)).toString('base64');
        for (let index = 0; index < texture.frames.length; index++) {
          const entry = texture.frames[index], frame = entry.frame, source = entry.spriteSourceSize, size = entry.sourceSize;
          if (seen.has(entry.filename)) throw new Error(`Duplicate animation pose ${entry.filename}`);
          seen.add(entry.filename); count++;
          if (frame.x < 0 || frame.y < 0 || frame.x + frame.w > texture.size.w || frame.y + frame.h > texture.size.h ||
              source.x < 0 || source.y < 0 || source.x + frame.w > size.w || source.y + frame.h > size.h ||
              source.w !== frame.w || source.h !== frame.h || !(entry.referenceHeight > 0)) throw new Error(`Invalid animation bounds: ${entry.filename}`);
          if (entry.feet && (source.y + source.h !== size.h || !entry.feet.some(foot => foot.y === size.h))) {
            throw new Error(`Missing ground contact: ${entry.filename}`);
          }
          if (name === 'dock-thrower' && (!entry.hand || entry.feet.length !== 2)) throw new Error(`Missing hand or planted shoes: ${entry.filename}`);
          if (name === 'garden-employee' && entry.filename.startsWith('pour') && !entry.pour) throw new Error('Missing sack mouth');
          for (const previous of texture.frames.slice(0, index)) {
            const other = previous.frame;
            if (Math.min(frame.x + frame.w, other.x + other.w) > Math.max(frame.x, other.x) &&
                Math.min(frame.y + frame.h, other.y + other.h) > Math.max(frame.y, other.y)) {
              throw new Error(`Overlapping animation cuts: ${entry.filename}, ${previous.filename}`);
            }
          }
        }
      }
      const directions = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
      const order = name === 'garden-observers' ? ['adult', 'kid'].flatMap(age => [0, 1, 2].flatMap(look =>
        [...WALK_CYCLE, 'watch'].map(pose => `observer-${age}-${look}-${pose}`)))
        : name.includes('swim') ? (name === 'fish-swimmers' ? ['koi', 'carp', 'minnow'] : name === 'bird-swimmers' ? ['duck', 'gull', 'coot'] : ['musk-turtle'])
          .flatMap(species => directions.flatMap(direction => SWIM_CYCLE.map(stroke => `${species}-${direction}-${stroke}`)))
          : name === 'dock-thrower' ? ['toss', 'overhand', 'spread'].flatMap(motion =>
            ['rest', `${motion}-anticipate`, `${motion}-windup`, `${motion}-drive`, `${motion}-release`,
              ...(motion === 'overhand' ? [`${motion}-settle`, `${motion}-follow`] : [`${motion}-follow`, `${motion}-settle`]), 'recover', `${motion}-return`])
            : [...WALK_CYCLE, 'open-reach', 'open', 'open-return', 'lift-half', 'lift-ready', 'lift-tip', 'lift', 'pour', 'close-lower', 'close-reach', 'close', 'close-return'];
      if (order.some(frame => !seen.has(frame))) throw new Error(`Missing cycle frames in ${name}`);
      const columns = name === 'garden-observers' || name === 'dock-thrower' ? 9 : name === 'garden-employee' ? 4 : 8;
      await page.setContent(`<style>body{margin:16px;background:#f4f0e6;color:#344b3e;font:11px monospace}h1{font:24px Georgia}main{display:grid;grid-template-columns:repeat(${columns},1fr);gap:6px}.pose{background:#dde6df;text-align:center;padding:5px}canvas{width:100%;height:auto;image-rendering:pixelated}p{margin:3px 0}</style><h1>${name}: actual drawings in animation order</h1><main></main>`);
      await page.evaluate(async ({ atlas, order, body }) => {
        const frames = new Map();
        for (const texture of atlas.textures) {
          const image = new Image(); image.src = texture.png; await image.decode();
          if (image.width !== texture.size.w || image.height !== texture.size.h) throw new Error('Animation PNG dimensions changed');
          for (const entry of texture.frames) frames.set(entry.filename, { entry, image });
        }
        for (const name of order) {
          const { entry, image } = frames.get(name), frame = entry.frame, source = entry.spriteSourceSize;
          const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = body ? 190 : 160;
          const context = canvas.getContext('2d'); context.imageSmoothingEnabled = false;
          const scale = (body ? 150 : 160) / entry.referenceHeight;
          const x = 80 + (source.x - entry.sourceSize.w / 2) * scale;
          const y = (body ? 180 : 80) + (source.y - entry.sourceSize.h * (body ? 1 : 0.5)) * scale;
          context.drawImage(image, frame.x, frame.y, frame.w, frame.h, x, y, frame.w * scale, frame.h * scale);
          if (body) { context.strokeStyle = '#6b8c78'; context.beginPath(); context.moveTo(0, 181); context.lineTo(160, 181); context.stroke(); }
          const card = document.createElement('div'); card.className = 'pose';
          const label = document.createElement('p'); label.textContent = name;
          card.append(canvas, label); document.querySelector('main').append(card);
        }
      }, { atlas, order, body: !name.includes('swim') });
      await page.screenshot({ path: path.join(output, `${name}-cycles.png`), fullPage: true });
    }
  } finally { await browser.close(); }
  console.log(`Reviewed ${count} animation poses with valid bounds, distinct cuts, hand pins, and ground contacts.`);
}
