import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

// Keep complete silhouettes apart even where their source bounding boxes overlap.
export async function buildFlightAtlas() {
  const filename = 'public/art/bird-flyers.png';
  const src = 'data:image/png;base64,' + (await fs.readFile(filename)).toString('base64');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true });
  let packed;
  try {
    const page = await browser.newPage();
    packed = await page.evaluate(async src => {
      const image = new Image(); image.src = src; await image.decode();
      const width = image.width, height = image.height;
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, width, height);
      const visited = new Uint8Array(width * height), boxes = [];
      const neighbors = index => {
        const x = index % width, y = Math.floor(index / width);
        return [x > 0 ? index - 1 : -1, x + 1 < width ? index + 1 : -1,
          y > 0 ? index - width : -1, y + 1 < height ? index + width : -1];
      };
      for (let index = 0; index < visited.length; index++) {
        if (visited[index] || data[index * 4 + 3] < 128) continue;
        const pixels = [index]; visited[index] = 1;
        let left = width, top = height, right = 0, bottom = 0;
        for (let cursor = 0; cursor < pixels.length; cursor++) {
          const current = pixels[cursor], x = current % width, y = Math.floor(current / width);
          left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
          for (const next of neighbors(current)) if (next >= 0 && !visited[next] && data[next * 4 + 3] >= 128) {
            visited[next] = 1; pixels.push(next);
          }
        }
        if (pixels.length > 700) boxes.push({ left, top, right, bottom, pixels });
      }
      if (boxes.length !== 48) throw new Error(`Expected 48 flight silhouettes; found ${boxes.length}.`);
      boxes.sort((a, b) => a.top + a.bottom - b.top - b.bottom);
      for (let row = 0; row < 6; row++) {
        boxes.splice(row * 8, 8, ...boxes.slice(row * 8, row * 8 + 8).sort((a, b) => a.left + a.right - b.left - b.right));
      }
      const owners = new Uint16Array(width * height), fringeDepth = new Uint8Array(width * height), queue = [];
      boxes.forEach((box, i) => box.pixels.forEach(index => { owners[index] = i + 1; queue.push(index); }));
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const index = queue[cursor];
        if (fringeDepth[index] >= 3) continue;
        for (const next of neighbors(index)) if (next >= 0 && !owners[next] && data[next * 4 + 3] > 0) {
          owners[next] = owners[index]; fringeDepth[next] = fringeDepth[index] + 1; queue.push(next);
        }
      }
      const slotSize = 320;
      const outputCanvas = document.createElement('canvas'); outputCanvas.width = slotSize * 8; outputCanvas.height = slotSize * 6;
      const output = outputCanvas.getContext('2d'), pixels = output.createImageData(outputCanvas.width, outputCanvas.height);
      const offsets = boxes.map((box, index) => {
        const stroke = Math.floor(index / 8) % 2;
        const bodyY = stroke === 0 ? 0.76 : index % 8 === 6 ? 0.6 : 0.4;
        return { x: index % 8 * slotSize + Math.round(slotSize / 2 - (box.left + box.right) / 2),
          y: Math.floor(index / 8) * slotSize + Math.round(slotSize / 2 - box.top - (box.bottom - box.top) * bodyY) };
      });
      for (const index of queue) {
        const slot = owners[index] - 1, offset = offsets[slot];
        const x = index % width + offset.x, y = Math.floor(index / width) + offset.y;
        if (x < slot % 8 * slotSize || x >= (slot % 8 + 1) * slotSize ||
            y < Math.floor(slot / 8) * slotSize || y >= (Math.floor(slot / 8) + 1) * slotSize) {
          throw new Error(`Flying bird ${slot} exceeds its normalized slot.`);
        }
        pixels.data.set(data.subarray(index * 4, index * 4 + 4), (y * outputCanvas.width + x) * 4);
      }
      output.putImageData(pixels, 0, 0);
      return { width: outputCanvas.width, height: outputCanvas.height, png: outputCanvas.toDataURL('image/png') };
    }, src);
  } finally { await browser.close(); }
  const frames = {}, directions = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
  for (let index = 0; index < 48; index++) {
    const name = `${['duck', 'gull', 'coot'][Math.floor(index / 16)]}-${directions[index % 8]}-${Math.floor(index / 8) % 2}`;
    frames[name] = { frame: { x: index % 8 * 320, y: Math.floor(index / 8) * 320, w: 320, h: 320 },
      rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: 320, h: 320 },
      sourceSize: { w: 320, h: 320 }, referenceHeight: 160 };
  }
  await fs.writeFile(filename, Buffer.from(packed.png.split(',')[1], 'base64'));
  await fs.writeFile('public/art/bird-flyers.json', JSON.stringify({ frames,
    meta: { image: 'bird-flyers.png', format: 'RGBA8888', size: { w: packed.width, h: packed.height }, scale: '1' } }, null, 2) + '\n');
  console.log('Packaged 48 bird flight frames in isolated, torso-anchored slots.');
}
