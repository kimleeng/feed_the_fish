import type Phaser from 'phaser';
import { WALK_DISTANCE, WALK_FRAMES, walkingFoot } from './walking.ts';

interface Point { x: number; y: number }
// Lower edge of the torso, below hands and coat hems, in units of body height.
const LEG_TOP = [-0.30, -0.28, -0.31, -0.27, -0.24, -0.36, -0.36];
const HEIGHT = 150, CELL_WIDTH = 120, CELL_HEIGHT = 162;
export const WALK_ATLAS = 'grounded-walkers';

// Bake 48 low steps using a complete, straight leg from the original artwork.
// Alpha outlines supply continuous leg strips; shoes translate without stretching.
export function createWalkingAtlas(scene: Phaser.Scene): void {
  if (scene.textures.exists(WALK_ATLAS)) return;
  const designs = (['adult', 'kid'] as const).flatMap(age => [0, 1, 2].map(look => ({
    name: `observer-${age}-${look}`, kind: age as 'adult' | 'kid' | 'employee',
    atlas: 'observer-rig-source', prefix: `observer-${age}-${look}-`,
  })));
  designs.push({ name: 'employee', kind: 'employee', atlas: 'employee-rig-source', prefix: '' });
  const texture = scene.textures.createCanvas(WALK_ATLAS, CELL_WIDTH * WALK_FRAMES, CELL_HEIGHT * designs.length)!;
  const context = texture.context;
  context.imageSmoothingEnabled = true;

  designs.forEach((design, row) => {
    const base = scene.textures.getFrame(design.atlas, design.prefix + 'walk-0')!;
    const referenceHeight = base.cutHeight;
    const waist = LEG_TOP[row];
    const lowSleeves = design.name === 'observer-kid-2';
    const legFrame = scene.textures.getFrame(design.atlas, design.prefix + 'walk-1')!;
    const frontPin = scene.cache.json.get(`${design.atlas}-pins`).meta.anchors[design.prefix + 'walk-1'].feet[1] as Point;
    const frontFoot = (frontPin.x - legFrame.realWidth / 2) / referenceHeight;
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = legFrame.cutWidth; sourceCanvas.height = legFrame.cutHeight;
    const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true })!;
    sourceContext.drawImage(legFrame.source.image as HTMLImageElement, legFrame.cutX, legFrame.cutY, legFrame.cutWidth, legFrame.cutHeight,
      0, 0, legFrame.cutWidth, legFrame.cutHeight);
    const pixels = sourceContext.getImageData(0, 0, legFrame.cutWidth, legFrame.cutHeight).data;
    const sourceX = (x: number) => (x + legFrame.x - legFrame.realWidth / 2) / referenceHeight;
    const ankleY = -0.075;
    const rows: { y: number; sourceY: number; left: number; right: number; center: number }[] = [];
    const first = Math.ceil(waist * referenceHeight + legFrame.realHeight - legFrame.y);
    const last = legFrame.realHeight - legFrame.y;
    for (let y = first; y < last; y++) {
      const normalizedY = (y + legFrame.y - legFrame.realHeight) / referenceHeight;
      let right = lowSleeves && normalizedY < -0.29
        ? Math.floor(0.16 * referenceHeight - legFrame.x + legFrame.realWidth / 2) : legFrame.cutWidth - 1;
      while (right > 0 && pixels[(y * legFrame.cutWidth + right) * 4 + 3] < 64) right--;
      let left = right;
      while (left > 0 && pixels[(y * legFrame.cutWidth + left - 1) * 4 + 3] >= 64) left--;
      // Where the thighs join, retain just the leading leg's material.
      if (normalizedY < ankleY) left = Math.max(left, right - referenceHeight * 0.145);
      rows.push({ y: normalizedY, sourceY: y, left, right: right + 1, center: sourceX((left + right + 1) / 2) });
    }
    const ankle = rows.reduce((best, point) => Math.abs(point.y - ankleY) < Math.abs(best.y - ankleY) ? point : best);
    const bodies = Array.from({ length: 4 }, (_, pose) => {
      const frame = scene.textures.getFrame(design.atlas, design.prefix + `walk-${pose}`)!;
      const sample = document.createElement('canvas'); sample.width = frame.cutWidth; sample.height = 1;
      const brush = sample.getContext('2d')!;
      brush.drawImage(frame.source.image as HTMLImageElement, frame.cutX,
        frame.cutY + Math.round(waist * referenceHeight + frame.realHeight - frame.y), frame.cutWidth, 1,
        0, 0, frame.cutWidth, 1);
      const alpha = brush.getImageData(0, 0, frame.cutWidth, 1).data;
      const runs: { left: number; right: number }[] = [];
      for (let x = 0; x < frame.cutWidth; x++) {
        const localX = (x + frame.x - frame.realWidth / 2) / referenceHeight;
        if (lowSleeves && (localX < -0.15 || localX > 0.16)) { alpha[x * 4 + 3] = 0; }
      }
      for (let x = 0; x < frame.cutWidth; x++) {
        if (alpha[x * 4 + 3] < 64) continue;
        const left = x;
        while (x < frame.cutWidth && alpha[x * 4 + 3] >= 64) x++;
        if (x - left > 4) runs.push({ left, right: x });
      }
      if (runs.length === 1) {
        const middle = (runs[0].left + runs[0].right) / 2;
        runs.push({ left: middle, right: runs[0].right }); runs[0].right = middle;
      }
      return { frame, hips: [runs[0], runs.at(-1)!].map(run => ({
        x: ((run.left + run.right) / 2 + frame.x - frame.realWidth / 2) / referenceHeight,
        width: (run.right - run.left) / referenceHeight,
      })) };
    });
    const drawSource = (frame: Phaser.Textures.Frame): void => {
      context.drawImage(frame.source.image as HTMLImageElement, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
        (frame.x - frame.realWidth / 2) / referenceHeight, (frame.y - frame.realHeight) / referenceHeight,
        frame.cutWidth / referenceHeight, frame.cutHeight / referenceHeight);
    };
    const drawLeg = (hip: { x: number; width: number }, foot: ReturnType<typeof walkingFoot>, bob: number): void => {
      const hipX = hip.x;
      const ankleX = foot.x + ankle.center - frontFoot;
      const ankleTargetY = ankle.y + foot.y;
      const hipY = waist + bob;
      for (const sample of rows) {
        const shoe = sample.y >= ankle.y;
        const t = Math.min(1, (sample.y - rows[0].y) / (ankle.y - rows[0].y));
        const bend = Math.sin(t * Math.PI) * (0.008 + Math.max(0, -foot.y) * 0.4);
        const targetX = hipX + (ankleX - hipX) * t + bend;
        const targetY = shoe ? sample.y + foot.y : hipY + (ankleTargetY - hipY) * t;
        const offset = foot.x - frontFoot;
        const height = shoe ? 1 / referenceHeight : (ankleTargetY - hipY) / (ankle.y - rows[0].y) / referenceHeight;
        const sourceWidth = (sample.right - sample.left) / referenceHeight;
        const width = shoe ? sourceWidth : sourceWidth * (1 + (hip.width / ((rows[0].right - rows[0].left) / referenceHeight) - 1) * (1 - t) ** 2);
        context.drawImage(sourceCanvas, sample.left, sample.sourceY, sample.right - sample.left, 1,
          shoe ? sourceX(sample.left) + offset : targetX - width / 2, targetY, width, height + 0.002);
      }
    };
    for (let index = 0; index < WALK_FRAMES; index++) {
      const phase = index / WALK_FRAMES;
      const footTargets = [0, 1].map(leg => walkingFoot(phase, leg, WALK_DISTANCE[design.kind], design.kind === 'kid' ? 0.04 : 0.025));
      const bob = Math.cos(phase * Math.PI * 4) * 0.002;
      const body = bodies[Math.floor((phase * 4 + 0.5) % 4)];
      context.save();
      context.beginPath(); context.rect(index * CELL_WIDTH, row * CELL_HEIGHT, CELL_WIDTH, CELL_HEIGHT); context.clip();
      context.translate(index * CELL_WIDTH + CELL_WIDTH / 2, (row + 1) * CELL_HEIGHT);
      context.scale(HEIGHT, HEIGHT);
      footTargets.forEach((foot, legIndex) => drawLeg(body.hips[legIndex], foot, bob));
      context.save(); context.translate(0, bob);
      context.beginPath(); context.rect(-0.5, -1.05, 1, 1.05 + waist + 0.002);
      if (lowSleeves) {
        // This child's jacket and hands hang below the hip; keep those outside
        // the trouser rig so their movement does not leave a bent upper thigh.
        context.moveTo(-0.5, waist); context.lineTo(-0.15, waist);
        context.lineTo(-0.18, -0.30); context.lineTo(-0.27, -0.28); context.lineTo(-0.5, -0.28); context.closePath();
        context.moveTo(0.18, waist); context.lineTo(0.5, waist);
        context.lineTo(0.5, -0.28); context.lineTo(0.26, -0.28); context.lineTo(0.24, -0.30); context.closePath();
      }
      context.clip();
      drawSource(body.frame); context.restore(); context.restore();

      const pixels = context.getImageData(index * CELL_WIDTH, row * CELL_HEIGHT, CELL_WIDTH, CELL_HEIGHT).data;
      let left = CELL_WIDTH, top = CELL_HEIGHT, right = 0, bottom = 0;
      for (let y = 0; y < CELL_HEIGHT; y++) for (let x = 0; x < CELL_WIDTH; x++) {
        if (pixels[(y * CELL_WIDTH + x) * 4 + 3] < 16) continue;
        left = Math.min(left, x); right = Math.max(right, x + 1); top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
      }
      const frame = texture.add(`${design.name}-gait-${index}`, 0, index * CELL_WIDTH + left, row * CELL_HEIGHT + top, right - left, bottom - top)!;
      frame.setTrim(CELL_WIDTH, CELL_HEIGHT, left, top, right - left, bottom - top);
      frame.customData = { referenceHeight: HEIGHT, feet: footTargets.map(foot => ({
        x: CELL_WIDTH / 2 + foot.x * HEIGHT, y: CELL_HEIGHT + foot.y * HEIGHT, planted: foot.planted,
      })) };
    }
  });
  texture.refresh();
}
