import test from 'node:test';
import assert from 'node:assert/strict';
import { WALK_DISTANCE, WALK_FRAMES, walkingFoot, walkingFrame, walkingOffset } from '../src/walking.ts';

test('walking keeps a supporting foot planted through frame holds and pose changes in either direction', () => {
  for (const distance of Object.values(WALK_DISTANCE).map(ratio => ratio * 150)) {
    for (const direction of [-1, 1]) {
      let previous: { x: number; planted: boolean }[] = [];
      for (let step = 0; step <= 600; step++) {
        const cycles = step / 300;
        const bakedPhase = walkingFrame(cycles) / WALK_FRAMES;
        const feet = [0, 1].map(leg => {
          const foot = walkingFoot(bakedPhase, leg, distance, 4);
          return { x: (cycles * distance + walkingOffset(cycles, distance) + foot.x) * direction, planted: foot.planted };
        });
        assert.ok(feet.some(foot => foot.planted), 'A walk never has both feet airborne');
        feet.forEach((foot, leg) => {
          if (foot.planted && previous[leg]?.planted) assert.ok(Math.abs(foot.x - previous[leg].x) < 1e-6);
        });
        previous = feet;
      }
    }
  }
});

test('foot swings stay low, all 48 poses are reachable, and the cycle boundary has no position jump', () => {
  assert.deepEqual(Array.from({ length: WALK_FRAMES }, (_, i) => walkingFrame(i / WALK_FRAMES)),
    Array.from({ length: WALK_FRAMES }, (_, i) => i));
  for (let i = 0; i < 1000; i++) for (const leg of [0, 1]) {
    const foot = walkingFoot(i / 1000, leg, 72, 4);
    assert.ok(foot.y >= -4 && foot.y <= 0);
  }
  assert.equal(walkingFrame(1 - 1e-10), WALK_FRAMES - 1);
  assert.equal(walkingFrame(1), 0);
  assert.ok(Math.abs(walkingOffset(1 - 1e-10, 72)) < 72 / WALK_FRAMES + 1e-6);
});
