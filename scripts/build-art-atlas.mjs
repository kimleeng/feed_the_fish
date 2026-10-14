import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

// Inspect alpha to package generated art. The PNG is read without editing its pixels.
const type = process.argv[2];
if (!['fish', 'turtle', 'machine', 'hand', 'observers', 'thrower', 'employee'].includes(type)) throw new Error('Usage: node scripts/build-art-atlas.mjs fish|turtle|machine|hand|observers|thrower|employee');
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
const basename = { fish: 'fish-swimmers', turtle: 'turtle-swimmer', machine: 'scene-machine', observers: 'garden-observers', thrower: 'dock-thrower', employee: 'garden-employee' }[type];
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
      const expected = type === 'observers' ? 30 : type === 'thrower' ? 12 : type === 'employee' ? 8 : type === 'turtle' ? 24 : 48;
      if (boxes.length !== expected) throw new Error(`Expected ${expected} ${type} silhouettes; found ${boxes.length}. Inspect the generated art before packaging.`);
      boxes.sort((a, b) => a.top + a.bottom - b.top - b.bottom);
      const columns = type === 'observers' ? 5 : type === 'thrower' || type === 'employee' ? 4 : 8;
      for (let row = 0; row < expected / columns; row++) {
        const ordered = boxes.slice(row * columns, row * columns + columns).sort((a, b) => a.left + a.right - b.left - b.right);
        boxes.splice(row * columns, columns, ...ordered);
      }
    }
    if (type === 'observers' || type === 'thrower' || type === 'employee') {
      const columns = type === 'observers' ? 5 : 4;
      for (const [index, box] of boxes.entries()) {
        const reference = boxes[index - index % columns];
        const standingHeight = reference.bottom - reference.top;
        const footTop = box.bottom - Math.ceil(standingHeight * 0.08);
        const runs = [];
        let run;
        for (let x = box.left; x <= box.right; x++) {
          let pixels = 0, bottom = 0;
          for (let y = footTop; y < box.bottom; y++) if (x < box.right && solid(y * width + x)) {
            pixels++; bottom = Math.max(bottom, y);
          }
          if (pixels) {
            if (!run) run = { left: x, right: x, pixels: 0, bottom: 0 };
            run.right = x; run.pixels += pixels; run.bottom = Math.max(run.bottom, bottom);
          } else if (run) { runs.push(run); run = undefined; }
        }
        box.feet = runs.filter(run => run.pixels > 10).sort((a, b) => b.pixels - a.pixels).slice(0, 2)
          .map(run => ({ x: (run.left + run.right) / 2, y: run.bottom + 1 })).sort((a, b) => a.x - b.x);
        if (type === 'thrower') {
          if (box.feet.length !== 2) throw new Error('The dock character needs two complete shoes in every pose.');
          box.anchorX = (box.feet[0].x + box.feet[1].x) / 2;
        } else {
          const hipPixels = [];
          for (let y = Math.floor(box.bottom - standingHeight * 0.46); y < box.bottom - standingHeight * 0.36; y++) {
            for (let x = box.left; x < box.right; x++) if (solid(y * width + x)) hipPixels.push(x);
          }
          hipPixels.sort((a, b) => a - b);
          box.anchorX = hipPixels[Math.floor(hipPixels.length / 2)];
        }
      }
    }
    return { width, height, boxes };
  }, { src, type });
} finally { await browser.close(); }

const frames = {};
const directions = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
const bodyAtlas = type === 'observers' || type === 'thrower' || type === 'employee';
const observerSize = { w: bodyAtlas ? Math.ceil(Math.max(...inspected.boxes.map(box =>
  Math.max(box.anchorX - box.left, box.right - box.anchorX))) * 2) + 12 : 0,
  h: Math.max(...inspected.boxes.map(box => box.bottom - box.top)) + 8 };
const throwerNames = ['empty', 'rest', 'toss-windup', 'toss-release', 'toss-follow', 'overhand-windup',
  'overhand-release', 'overhand-follow', 'spread-windup', 'spread-release', 'spread-follow', 'recover'];
const anchors = {};
const turtlePins = type === 'turtle' ? JSON.parse(await fs.readFile('public/art/turtle-swimmer-pins.json', 'utf8')) : null;
// Closely spaced body rows have only a one-pixel gap. Keep their opaque cuts
// separate; fish and machine artwork can retain the surrounding padding.
const padding = bodyAtlas ? 0 : 2;
for (let index = 0; index < inspected.boxes.length; index++) {
  const box = inspected.boxes[index];
  const x = Math.max(0, box.left - padding); const y = Math.max(0, box.top - padding);
  const w = Math.min(inspected.width, box.right + padding) - x; const h = Math.min(inspected.height, box.bottom + padding) - y;
  if ((type === 'fish' || (type === 'turtle' && index < 16)) && (w > 224 || h > 224)) throw new Error('Swimmer exceeds the shared 224px source size.');
  for (const [previousName, entry] of Object.entries(frames)) {
    const previous = entry.frame;
    if (Math.min(x + w, previous.x + previous.w) > Math.max(x, previous.x) &&
        Math.min(y + h, previous.y + previous.h) > Math.max(y, previous.y)) {
      throw new Error(`Generated frame ${index} (${x},${y},${w},${h}) overlaps ${previousName} (${previous.x},${previous.y},${previous.w},${previous.h}).`);
    }
  }
  const name = type === 'fish' ? `${['koi', 'carp', 'minnow'][Math.floor(index / 16)]}-${directions[index % 8]}-${Math.floor(index / 8) % 2}`
    : type === 'turtle' ? `musk-turtle-${directions[index % 8]}-${index < 16 ? Math.floor(index / 8) : 'head'}`
    : type === 'observers' ? `observer-${index < 15 ? 'adult' : 'kid'}-${Math.floor(index / 5) % 3}-${['walk-0', 'walk-1', 'walk-2', 'walk-3', 'watch'][index % 5]}`
      : type === 'thrower' ? throwerNames[index]
        : type === 'employee' ? ['walk-0', 'walk-1', 'walk-2', 'walk-3', 'open', 'lift', 'pour', 'close'][index] : 'machine';
  const turtleHead = type === 'turtle' && index >= 16;
  const size = type === 'fish' || type === 'turtle' ? { w: turtleHead ? 448 : 224, h: turtleHead ? 448 : 224 } : bodyAtlas ? observerSize : { w, h };
  const source = { x: bodyAtlas ? Math.round(size.w / 2 - (box.anchorX - x)) : Math.floor((size.w - w) / 2),
    y: bodyAtlas ? size.h - h : Math.floor((size.h - h) / 2) };
  if (type === 'turtle') {
    const pin = turtlePins[directions[index % 8]];
    const reference = inspected.boxes[index % 8];
    const offset = { x: pin.x - (reference.left + reference.right) / 2, y: pin.y - (reference.top + reference.bottom) / 2 };
    if (pin.x < reference.left || pin.x > reference.right || pin.y < reference.top || pin.y > reference.bottom) {
      throw new Error('Turtle head pins must fall inside the matching swim pose.');
    }
    if (turtleHead) {
      // Heads were drawn at twice the body detail; keep their actual size and anchor aligned.
      source.x += Math.round(offset.x * 2); source.y += Math.round(offset.y * 2);
    }
    anchors[directions[index % 8]] = { x: offset.x / 224, y: offset.y / 224 };
  }
  if (source.x < 0 || source.y < 0 || source.x + w > size.w || source.y + h > size.h) {
    throw new Error(`${name} crosses its grid cell. Correct sprite spacing before packaging.`);
  }
  frames[name] = {
    frame: { x, y, w, h }, rotated: false, trimmed: type !== 'machine',
    spriteSourceSize: { ...source, w, h }, sourceSize: size,
  };
  if (bodyAtlas) anchors[name] = { axis: source.x + box.anchorX - x, feet: box.feet.map(foot =>
    ({ x: source.x + foot.x - x, y: source.y + foot.y - y })) };
}
const meta = { image: `${basename}.png`, format: 'RGBA8888', size: { w: inspected.width, h: inspected.height }, scale: '1' };
if (bodyAtlas) meta.anchors = anchors;
if (type === 'employee') {
  const pin = JSON.parse(await fs.readFile('public/art/garden-employee-pins.json', 'utf8')).pour;
  const entry = frames.pour, frame = entry.frame, source = entry.spriteSourceSize;
  if (pin.x < frame.x || pin.x >= frame.x + frame.w || pin.y < frame.y || pin.y >= frame.y + frame.h) {
    throw new Error('The pellet stream needs a pin inside the actual sack opening.');
  }
  const height = frames['walk-0'].frame.h;
  const mouth = { x: source.x + pin.x - frame.x, y: source.y + pin.y - frame.y };
  const offset = { x: (mouth.x - entry.sourceSize.w / 2) / height, y: (mouth.y - entry.sourceSize.h) / height };
  const contacts = [0, 2].map(index => anchors[`walk-${index}`].feet);
  if (contacts.some(feet => feet.length !== 2)) throw new Error('Employee contact poses need two distinct shoes.');
  const stride = contacts.reduce((sum, feet) => sum + feet[1].x - feet[0].x, 0) / height;
  meta.pour = mouth; meta.strideRatio = stride;
  await fs.writeFile('src/employee-pins.ts', '// Generated by scripts/build-art-atlas.mjs employee from the sack opening and walking contacts.\n' +
    'export const EMPLOYEE_POUR_OFFSET = ' + JSON.stringify(offset, null, 2) + ';\n' +
    'export const EMPLOYEE_STRIDE_RATIO = ' + stride + ';\n');
}
if (type === 'turtle') {
  meta.headOffsets = anchors;
  await fs.writeFile('src/turtle-pins.ts', '// Generated by scripts/build-art-atlas.mjs turtle from head positions in the swimming artwork.\n' +
    'export const TURTLE_HEAD_OFFSETS = ' + JSON.stringify(anchors, null, 2) + ';\n');
}
if (type === 'observers') {
  const ratios = { adult: [], kid: [] };
  for (const age of ['adult', 'kid']) for (let look = 0; look < 3; look++) {
    const reference = frames[`observer-${age}-${look}-walk-0`];
    const contacts = [0, 2].map(phase => anchors[`observer-${age}-${look}-walk-${phase}`].feet);
    if (contacts.some(feet => feet.length !== 2)) throw new Error('Contact poses need two distinct feet for stride calibration.');
    ratios[age].push(Number((contacts.reduce((sum, feet) => sum + feet[1].x - feet[0].x, 0) / reference.frame.h).toFixed(5)));
  }
  meta.strideRatios = ratios;
  await fs.writeFile('src/observer-gait.ts', '// Generated by scripts/build-art-atlas.mjs observers from the two contact poses.\n' +
    'export const STRIDE_RATIOS = ' + JSON.stringify(ratios, null, 2) + ';\n');
}
if (type === 'thrower') {
  const pins = JSON.parse(await fs.readFile('public/art/dock-thrower-pins.json', 'utf8'));
  const offsets = {}; meta.hands = {};
  const scale = 145 / frames.empty.frame.h;
  for (const name of throwerNames) {
    const entry = frames[name], point = pins[name], frame = entry.frame, source = entry.spriteSourceSize;
    if (!point || point.x < frame.x || point.x > frame.x + frame.w || point.y < frame.y || point.y > frame.y + frame.h) {
      throw new Error(`Annotate the throwing hand inside the actual ${name} cut in dock-thrower-pins.json.`);
    }
    const hand = { x: source.x + point.x - frame.x, y: source.y + point.y - frame.y };
    meta.hands[name] = hand;
    offsets[name] = { x: Number(((hand.x - entry.sourceSize.w / 2) * scale).toFixed(5)),
      y: Number(((hand.y - entry.sourceSize.h) * scale).toFixed(5)) };
  }
  await fs.writeFile('src/thrower-pins.ts', '// Generated by scripts/build-art-atlas.mjs thrower from the annotated hand positions.\n' +
    'export const THROWER_HAND_OFFSETS = ' + JSON.stringify(offsets, null, 2) + ';\n');
}
await fs.writeFile(`public/art/${basename}.json`, JSON.stringify({ frames, meta: {
  ...meta,
} }, null, 2) + '\n');
console.log(`Packaged ${Object.keys(frames).length} ${type} frames without changing PNG pixels.`);
