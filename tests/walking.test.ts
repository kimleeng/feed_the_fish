import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { walkingDistance, walkingFrame, walkingFrames, type WalkingDesign } from '../src/walking.ts';
import { OBSERVER_DESIGNS } from '../src/observer-looks.ts';
import { WALKING_GAIT } from '../src/walking-gait.ts';

test('complete walking cycles wrap in either direction and visit every drawing', () => {
  for (const design of [...OBSERVER_DESIGNS.map(person => person.design), 'employee'] as WalkingDesign[]) {
    const count = walkingFrames(design);
    for (const cycle of [-2, 0, 3]) {
      assert.deepEqual(WALKING_GAIT[design].phases.map(phase => walkingFrame(cycle + phase, design)),
        Array.from({ length: count }, (_, i) => i));
    }
    assert.equal(walkingFrame(1 - 1e-10, design), count - 1);
    assert.equal(walkingFrame(1, design), 0);
  }
});

test('supporting-shoe annotations follow ground travel at authored phases', () => {
  const atlas = JSON.parse(readFileSync(new URL('../public/art/people-walking.json', import.meta.url), 'utf8'));
  for (const design of ['observer-adult-0', 'observer-kid-0'] as const) {
    const texture = atlas.textures.find((texture: { image: string }) => texture.image === design + '-walking-smooth.png');
    const height = texture.frames[0].referenceHeight;
    const distance = walkingDistance(design, height);
    for (const leg of ['near', 'far']) {
      const poses = texture.frames.filter((frame: { supportLeg?: string }) => frame.supportLeg === leg);
      assert.ok(poses.length >= 4, `${design}: the ${leg} leg needs its own complete stance`);
      const ground = poses.map((frame: { posePhase: number; supportFoot: { x: number }; sourceSize: { w: number } }) =>
        frame.posePhase * distance + frame.supportFoot.x - frame.sourceSize.w / 2);
      assert.ok(Math.max(...ground) - Math.min(...ground) < 1,
        `${design}: the ${leg} supporting shoe jumps along the ground`);
    }
    const phases: readonly number[] = WALKING_GAIT[design].phases;
    assert.equal(phases.length, walkingFrames(design));
    for (let i = 0; i < phases.length; i++) assert.ok((phases[i + 1] ?? 1) - phases[i] >= .017);
  }
});

test('the full-stride contact poses put each leg behind the hips and use even frame durations', () => {
  const atlas = JSON.parse(readFileSync(new URL('../public/art/people-walking.json', import.meta.url), 'utf8'));
  for (const design of ['observer-adult-0', 'observer-kid-0'] as const) {
    const texture = atlas.textures.find((texture: { image: string }) => texture.image === design + '-walking-smooth.png');
    const height = texture.frames[0].referenceHeight, phases = WALKING_GAIT[design].phases;
    assert.equal(phases.length, 48);
    for (let i = 0; i < phases.length; i++) assert.ok(Math.abs((phases[i + 1] ?? 1) - phases[i] - 1 / phases.length) < 1e-9);
    const contacts = texture.frames.filter((frame: { keyPose?: string }) => frame.keyPose?.endsWith('contact'));
    assert.equal(contacts.length, 2);
    for (const contact of contacts) {
      const front = contact.keyPose === 'near-contact' ? contact.nearFoot : contact.farFoot;
      const back = contact.keyPose === 'near-contact' ? contact.farFoot : contact.nearFoot;
      assert.ok(front && back && contact.hip, `${design}: both feet and the hip must be traced`);
      assert.ok(front.x - contact.hip.x > height * .1, `${design}: the leading foot must reach forward`);
      assert.ok(contact.hip.x - back.x > height * .1, `${design}: the trailing leg must extend behind the hips`);
    }
  }
});

test('each walker uses separate intact PNG drawings with one scale and a shared sole baseline', () => {
  const atlas = JSON.parse(readFileSync(new URL('../public/art/people-walking.json', import.meta.url), 'utf8'));
  assert.equal(atlas.textures.length, OBSERVER_DESIGNS.length + 1);
  for (const texture of atlas.textures) {
    const png = readFileSync(new URL('../public/art/' + texture.image, import.meta.url));
    assert.equal(png.readUInt32BE(16), texture.size.w);
    assert.equal(png.readUInt32BE(20), texture.size.h);
    const design = texture.frames[0].filename.replace(/-step-0$/, '') as WalkingDesign;
    const count = walkingFrames(design);
    const watching = OBSERVER_DESIGNS.find(person => person.design === design)?.watchingInSheet;
    assert.equal(texture.frames.length, count + (watching ? 1 : 0));
    const height = texture.frames[0].referenceHeight;
    const distance = walkingDistance(design, height);
    assert.ok(distance > height * 0.2 && distance < height * 1.2);
    assert.equal(walkingDistance(design, height * 2), distance * 2);
    const shapes = new Set<string>();
    for (const [index, entry] of texture.frames.entries()) {
      const { frame, sourceSize, spriteSourceSize: source } = entry;
      assert.equal(entry.filename, `${design}-${index === count ? 'watch' : `step-${index}`}`);
      assert.equal(entry.referenceHeight, height);
      assert.equal(entry.rotated, false);
      assert.equal(source.w, frame.w); assert.equal(source.h, frame.h);
      assert.equal(source.y + source.h, sourceSize.h);
      assert.ok(source.x >= 0 && source.x + source.w <= sourceSize.w);
      assert.ok(frame.x >= 0 && frame.y >= 0 && frame.x + frame.w <= texture.size.w && frame.y + frame.h <= texture.size.h);
      shapes.add(JSON.stringify(frame));
      for (const other of texture.frames.slice(index + 1)) {
        assert.ok(frame.x + frame.w <= other.frame.x || other.frame.x + other.frame.w <= frame.x ||
          frame.y + frame.h <= other.frame.y || other.frame.y + other.frame.h <= frame.y);
      }
    }
    assert.equal(shapes.size, texture.frames.length);
  }
});
