import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const design = process.argv[2];
if (!['observer-adult-0', 'observer-kid-0'].includes(design)) throw new Error('Choose observer-adult-0 or observer-kid-0');
const root = 'art-source/walking/' + design;
const source = JSON.parse(await fs.readFile(root + '-poses.json', 'utf8'));
const count = source.frames, frames = 48, cell = source.cell, size = cell * cell;
const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'pond-walk-'));

// Track the planted shoe through each half, including the next contact. Prefer
// the low shoe and a backward sweep; this avoids swapping feet as they overlap.
const feet = source.poses.map(pose => [...(pose.feet ?? [pose.nearFoot, pose.farFoot])].sort((a, b) => a.x - b.x));
function stance(start, end) {
  const startX = feet[start % count][1].x, endX = feet[end % count][0].x;
  const costs = [[Infinity, 0]], previous = [];
  for (let step = 1; step <= end - start; step++) {
    const candidates = feet[(start + step) % count], before = feet[(start + step - 1) % count];
    const target = startX + (endX - startX) * step / (end - start);
    const low = Math.max(...candidates.map(p => p.y));
    const next = [], back = [];
    for (let index = 0; index < 2; index++) {
      if (step === end - start && index !== 0) { next.push(Infinity); back.push(0); continue; }
      const options = before.map((p, i) => {
        const advance = p.x - candidates[index].x;
        return costs.at(-1)[i] + Math.max(0, -advance - 3) ** 2 * 8 + advance ** 2 * .006;
      });
      const best = options[0] <= options[1] ? 0 : 1;
      next.push(options[best] + (candidates[index].x - target) ** 2 * .008 + (low - candidates[index].y) ** 2 * .3);
      back.push(best);
    }
    costs.push(next); previous.push(back);
  }
  const selected = [0]; let index = 0;
  for (let step = end - start; step > 0; step--) { index = previous[step - 1][index]; selected.unshift(index); }
  // Pool small backwards-in-time rolls of the painted shoe into one position.
  const blocks = [];
  selected.forEach((choice, step) => {
    const weight = step === 0 || step === end - start ? 1e6 : 1;
    blocks.push({ start: step, end: step, sum: feet[(start + step) % count][choice].x * weight, weight });
    while (blocks.length > 1 && blocks.at(-2).sum / blocks.at(-2).weight < blocks.at(-1).sum / blocks.at(-1).weight) {
      const b = blocks.pop(), a = blocks.pop(); blocks.push({ start: a.start, end: b.end, sum: a.sum + b.sum, weight: a.weight + b.weight });
    }
  });
  const positions = [];
  for (const block of blocks) for (let i = block.start; i <= block.end; i++) positions[i] = block.sum / block.weight;
  return { selected, positions, startX, endX };
}
const half = count / 2, near = stance(0, half), far = stance(half, count);
const nearSweep = near.startX - near.endX, farSweep = far.startX - far.endX, distance = nearSweep + farSweep;
const contact = nearSweep / distance;
const phases = source.poses.map((pose, i) => {
  const first = i < half, sweep = first ? near : far, local = i % half;
  const choice = sweep.selected[local], centers = feet[i];
  pose.nearFoot = centers[first ? choice : 1 - choice];
  pose.farFoot = centers[first ? 1 - choice : choice];
  return (first ? 0 : contact) + (sweep.startX - sweep.positions[local]) / distance;
});
// Redundant drawings at the same stance position need no extra hold time.
const selected = phases.map((phase, index) => ({ phase, index })).filter((p, i) => i === 0 || p.phase - phases[i - 1] > .0001);
const sourceCount = selected.length;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true });
try {
  const page = await browser.newPage();
  const png = 'data:image/png;base64,' + (await fs.readFile(root + '-poses.png')).toString('base64');
  const raw = await page.evaluate(async ({ png, source, selected }) => {
    const image = new Image(); image.src = png; await image.decode();
    const c = document.createElement('canvas'); c.width = source.cell; c.height = source.cell;
    const g = c.getContext('2d', { willReadFrequently: true });
    const size = c.width * c.height, pixels = new Uint8Array(selected.length * size * 4), guide = new Uint8Array(selected.length * size);
    for (const [slot, { index }] of selected.entries()) {
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(image, index % source.columns * source.cell, Math.floor(index / source.columns) * source.cell, source.cell, source.cell, 0, 0, c.width, c.height);
      const data = g.getImageData(0, 0, c.width, c.height).data;
      pixels.set(data, slot * size * 4);
      const pose = source.poses[index];
      for (let p = 0; p < size; p++) {
        const x = p % c.width, y = Math.floor(p / c.width), q = p * 4, alpha = data[q + 3] / 255;
        const luminance = data[q] * .2126 + data[q + 1] * .7152 + data[q + 2] * .0722;
        let label = 100;
        if (y > source.ground - source.height * .4) {
          const t = Math.max(0, Math.min(1, (y - (source.ground - source.height * .4)) / (source.height * .36)));
          const nx = pose.hip.x * (1 - t) + pose.nearFoot.x * t, fx = pose.hip.x * (1 - t) + pose.farFoot.x * t;
          label = Math.abs(x - nx) < Math.abs(x - fx) ? 190 : 30;
        }
        guide[slot * size + p] = Math.round((label * .45 + luminance * .55) * alpha);
      }
    }
    const base64 = bytes => { let out = ''; for (let i = 0; i < bytes.length; i += 16384) out += String.fromCharCode(...bytes.subarray(i, i + 16384)); return btoa(out); };
    return { pixels: base64(pixels), guide: base64(guide) };
  }, { png, source, selected });
  const rgba = Buffer.from(raw.pixels, 'base64'), guide = Buffer.from(raw.guide, 'base64');
  for (const layer of ['color', 'alpha']) {
    const input = Buffer.alloc(sourceCount * 3 * size * 4);
    for (let f = 0; f < sourceCount * 3; f++) {
      const k = f % sourceCount, offset = f * size * 4;
      guide.copy(input, offset, k * size, (k + 1) * size);
      for (let p = 0; p < size; p++) {
        const q = (k * size + p) * 4, a = rgba[q + 3];
        if (layer === 'color') for (let channel = 0; channel < 3; channel++) input[offset + size * (channel + 1) + p] = Math.round(rgba[q + channel] * a / 255);
        else { input[offset + size + p] = a; input[offset + size * 3 + p] = 255; }
      }
    }
    await fs.writeFile(path.join(workspace, layer + '.yuva'), input);
    const expression = selected.reduceRight((text, p, i) => `if(eq(mod(N,${sourceCount}),${i}),${p.phase},${text})`, '0');
    const filter = `settb=1/1000000,setpts='(floor(N/${sourceCount})+${expression})/TB',minterpolate=fps=${frames}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:me=hexbs:mb_size=8:search_param=48:vsbmc=1:scd=none,select='between(n,${frames},${frames * 2 - 1})'`;
    await run('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pixel_format', 'yuva444p', '-video_size', `${cell}x${cell}`, '-framerate', String(sourceCount), '-i', path.join(workspace, layer + '.yuva'), '-vf', filter, '-fps_mode', 'passthrough', '-frames:v', String(frames), '-pix_fmt', 'yuva444p', '-f', 'rawvideo', path.join(workspace, layer + '-flow.yuva')], { maxBuffer: 1024 * 1024 });
    console.log(`${design}: ${layer} in-betweens ready`);
  }
  const color = await fs.readFile(path.join(workspace, 'color-flow.yuva')), alpha = await fs.readFile(path.join(workspace, 'alpha-flow.yuva'));
  if (color.length !== frames * size * 4 || alpha.length !== color.length) throw new Error('Incomplete interpolated cycle');
  const pixels = Buffer.alloc(frames * size * 4);
  for (let f = 0; f < frames; f++) for (let p = 0; p < size; p++) {
    const from = f * size * 4, to = (f * size + p) * 4, a = alpha[from + size + p];
    pixels[to + 3] = a;
    if (a) for (let channel = 0; channel < 3; channel++) pixels[to + channel] = Math.min(255, Math.round(color[from + size * (channel + 1) + p] * 255 / a));
  }
  await fs.writeFile(path.join(workspace, 'flow.rgba'), pixels);
  await run('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', `${cell}x${cell}`,
    '-framerate', String(frames), '-i', path.join(workspace, 'flow.rgba'), '-vf', `tile=6x${Math.ceil(frames / 6)}`,
    '-frames:v', '1', root + '-cycle.png']);
  const phasesOut = Array.from({ length: frames }, (_, i) => i / frames);
  const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const poses = phasesOut.map(phase => {
    let i = selected.findLastIndex(p => p.phase <= phase); if (i < 0) i = 0;
    const a = selected[i], b = selected[(i + 1) % sourceCount], end = i + 1 === sourceCount ? 1 : b.phase;
    const t = (phase - a.phase) / (end - a.phase), before = source.poses[a.index], after = source.poses[b.index];
    const first = phase < contact;
    return { supportLeg: first ? 'near' : 'far', supportFoot: { x: (first ? near.startX : far.startX) - (phase - (first ? 0 : contact)) * distance, y: source.ground },
      nearFoot: mix(before.nearFoot, after.nearFoot, t), farFoot: mix(before.farFoot, after.farFoot, t), hip: mix(before.hip, after.hip, t) };
  });
  const keyFrames = [];
  for (const [phase, keyPose] of [[0, 'near-contact'], [(near.startX - source.cell / 2) / distance, 'far-passing'], [contact, 'far-contact'], [contact + (far.startX - source.cell / 2) / distance, 'near-passing']]) {
    const index = Math.round(phase * frames) % frames;
    poses[index].keyPose = keyPose; keyFrames.push(index);
  }
  await fs.writeFile(path.join(workspace, 'keys.rgba'), Buffer.concat(keyFrames.map(index => pixels.subarray(index * size * 4, (index + 1) * size * 4))));
  await run('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', `${cell}x${cell}`,
    '-framerate', '4', '-i', path.join(workspace, 'keys.rgba'), '-vf', 'tile=2x2', '-frames:v', '1', root + '-keys.png']);
  await fs.writeFile(root + '.json', JSON.stringify({ version: 3, cell, columns: 6, ground: source.ground, height: source.height,
    output: { cell: 320, height: 260, ground: 308 }, frames, cyclePixels: distance, seconds: design.includes('kid') ? 1.8 : 2,
    phases: phasesOut, poses }, null, 2) + '\n');
  console.log(`${design}: ${frames} evenly spaced full poses; cycle ${distance.toFixed(1)} source pixels`);
} finally { await browser.close(); await fs.rm(workspace, { recursive: true, force: true }); }
