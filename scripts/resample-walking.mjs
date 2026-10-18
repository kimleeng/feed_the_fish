import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

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
try {
  const timing = path.join(workspace, 'timing.json'), raw = path.join(workspace, 'flow.rgba');
  await fs.writeFile(timing, JSON.stringify({ cell, columns: source.columns, frames,
    selected: selected.map(pose => ({ ...pose, landmarks: Object.fromEntries(
      ['nearFoot', 'farFoot', 'hip'].map(key => [key, source.poses[pose.index][key]])) })) }));
  // Warp one complete drawing per output frame. Blending independently tracked
  // silhouettes creates translucent duplicate arms and legs at occlusions.
  await run(process.env.PYTHON || 'python3', [fileURLToPath(new URL('./interpolate-walking.py', import.meta.url)),
    root + '-poses.png', timing, raw], { maxBuffer: 1024 * 1024 });
  const pixels = await fs.readFile(raw);
  const painted = JSON.parse(await fs.readFile(path.join(workspace, 'flow.json'), 'utf8'));
  if (pixels.length !== frames * size * 4 || painted.length !== frames) throw new Error('Incomplete interpolated cycle');
  await run('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', `${cell}x${cell}`,
    '-framerate', String(frames), '-i', path.join(workspace, 'flow.rgba'), '-vf', `tile=6x${Math.ceil(frames / 6)}`,
    '-frames:v', '1', root + '-cycle.png']);
  const phasesOut = Array.from({ length: frames }, (_, i) => i / frames);
  const poses = phasesOut.map((phase, i) => {
    const first = phase < contact;
    return { supportLeg: first ? 'near' : 'far', supportFoot: { x: (first ? near.startX : far.startX) - (phase - (first ? 0 : contact)) * distance, y: source.ground },
      ...painted[i] };
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
} finally { await fs.rm(workspace, { recursive: true, force: true }); }
