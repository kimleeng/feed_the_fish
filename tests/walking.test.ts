import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WALK_FRAMES, walkingDistance, walkingFrame, type WalkingDesign } from '../src/walking.ts';

test('complete walking cycles wrap in either direction and visit every drawing', () => {
  for (const cycle of [-2, 0, 3]) {
    assert.deepEqual(Array.from({ length: WALK_FRAMES }, (_, i) => walkingFrame(cycle + i / WALK_FRAMES)),
      Array.from({ length: WALK_FRAMES }, (_, i) => i));
  }
  assert.equal(walkingFrame(1 - 1e-10), WALK_FRAMES - 1);
  assert.equal(walkingFrame(1), 0);
});

test('each walker uses separate intact PNG drawings with one scale and a shared sole baseline', () => {
  const atlas = JSON.parse(readFileSync(new URL('../public/art/people-walking.json', import.meta.url), 'utf8'));
  assert.equal(atlas.textures.length, 7);
  for (const texture of atlas.textures) {
    assert.equal(texture.frames.length, WALK_FRAMES);
    const png = readFileSync(new URL('../public/art/' + texture.image, import.meta.url));
    assert.equal(png.readUInt32BE(16), texture.size.w);
    assert.equal(png.readUInt32BE(20), texture.size.h);
    const design = texture.frames[0].filename.replace(/-step-0$/, '') as WalkingDesign;
    const height = texture.frames[0].referenceHeight;
    const distance = walkingDistance(design, height);
    assert.ok(distance > height * 0.2 && distance < height * 1.2);
    assert.equal(walkingDistance(design, height * 2), distance * 2);
    const shapes = new Set<string>();
    for (const [index, entry] of texture.frames.entries()) {
      const { frame, sourceSize, spriteSourceSize: source } = entry;
      assert.equal(entry.filename, `${design}-step-${index}`);
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
    assert.equal(shapes.size, WALK_FRAMES);
  }
});
