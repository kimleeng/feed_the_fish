import test from 'node:test';
import assert from 'node:assert/strict';
import { HandIconDeck, EMPTY_HAND_ICON } from '../src/hand-icon.ts';

test('hand previews shuffle through all ten regular images without repeats at the bag boundary', () => {
  let seed = 42;
  const icons = new HandIconDeck(() => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 2 ** 32));
  let previous = -1;
  for (let bag = 0; bag < 4; bag++) {
    const frames = Array.from({ length: 10 }, (_, i) => icons.update(bag * 10 + i, true, false));
    assert.notEqual(frames[0], previous);
    assert.deepEqual([...frames].sort((a, b) => a - b), Array.from({ length: 10 }, (_, i) => i));
    assert.notDeepEqual(frames, Array.from({ length: 10 }, (_, i) => i));
    previous = frames.at(-1)!;
  }
});

test('a handful stays unchanged between throws, and lucky handfuls use their own two-image deck', () => {
  let randomCalls = 0;
  const icons = new HandIconDeck(() => { randomCalls++; return 0.3; });
  const regular = icons.update(0, true, false);
  const calls = randomCalls;
  for (let tick = 0; tick < 50; tick++) assert.equal(icons.update(0, true, false), regular);
  assert.equal(randomCalls, calls, 'HUD refreshes and pauses must not reshuffle the palm');
  const lucky = Array.from({ length: 6 }, (_, i) => icons.update(i + 1, true, true));
  assert.deepEqual(new Set(lucky), new Set([10, 11]));
  assert.ok(lucky.every((frame, i) => i === 0 || frame !== lucky[i - 1]));
  assert.notEqual(icons.update(7, true, false), regular, 'Lucky throws do not consume the regular deck');
});

test('running out shows an empty palm and collecting food starts a new handful', () => {
  const icons = new HandIconDeck(() => 0.4);
  assert.equal(icons.update(0, false, false), EMPTY_HAND_ICON);
  const first = icons.update(0, true, false);
  assert.ok(first < 10);
  assert.equal(icons.update(1, false, true), EMPTY_HAND_ICON);
  assert.equal(icons.update(1, false, false), EMPTY_HAND_ICON);
  assert.notEqual(icons.update(1, true, false), first);
});
