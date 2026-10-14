import test from 'node:test';
import assert from 'node:assert/strict';
import { WindSimulation } from '../src/wind.ts';
import { WaterShimmer } from '../src/water.ts';
import { PondSimulation, inPond } from '../src/simulation.ts';

test('the same wind seed reproduces continuous weather and exact recorded samples across frame rates', () => {
  const slow = new WindSimulation(1234);
  const fast = new WindSimulation(1234);
  for (let frame = 1; frame <= 77; frame++) slow.advanceTo(frame / 4);
  for (let frame = 1; frame <= 1155; frame++) fast.advanceTo(frame / 60);
  assert.deepEqual(fast.current, slow.current);
  assert.deepEqual(fast.history, slow.history);
  assert.notDeepEqual(fast.current, new WindSimulation(5678).sampleAt(19.25));
  assert.deepEqual(fast.history.map(sample => sample.time), Array.from({ length: 20 }, (_, index) => index));
  for (const sample of fast.history) assert.deepEqual(sample, fast.sampleAt(sample.time));
});

test('the breeze changes direction and strength smoothly and exposes a consistent vector', () => {
  const wind = new WindSimulation(42);
  const initial = wind.current;
  let previous = initial;
  let minStrength = 1; let maxStrength = 0; let maxTurn = 0;
  for (let frame = 0; frame < 3000; frame++) {
    const state = wind.sampleAt(frame / 10);
    assert.ok(state.direction >= 0 && state.direction < Math.PI * 2);
    assert.ok(state.strength >= 0 && state.strength <= 1);
    assert.ok(Math.abs(Math.hypot(state.x, state.y) - state.strength) < 1e-12);
    const turn = Math.atan2(Math.sin(state.direction - previous.direction), Math.cos(state.direction - previous.direction));
    assert.ok(Math.abs(turn) < 0.01);
    assert.ok(Math.abs(state.strength - previous.strength) < 0.03);
    maxTurn = Math.max(maxTurn, Math.abs(Math.atan2(Math.sin(state.direction - initial.direction), Math.cos(state.direction - initial.direction))));
    minStrength = Math.min(minStrength, state.strength); maxStrength = Math.max(maxStrength, state.strength);
    previous = state;
  }
  assert.ok(maxStrength - minStrength > 0.25);
  assert.ok(maxTurn > 0.2);
  assert.equal(wind.history.length, 1, 'Inspecting a time must not advance or record the wind');
});

test('a visit records timestamped snapshots without rewriting earlier values, and supports exact replay', () => {
  const wind = new WindSimulation(90);
  wind.advanceTo(2.4);
  const earlier = wind.history.map(sample => ({ ...sample }));
  wind.advanceTo(7200.5);
  assert.deepEqual(wind.history.slice(0, 3), earlier);
  assert.equal(wind.history.length, 7201);
  assert.equal(wind.history.at(-1)!.time, 7200);
  wind.advanceTo(7200.5);
  assert.equal(wind.history.length, 7201, 'An unchanged clock must not duplicate samples');
  assert.deepEqual(new WindSimulation(wind.seed).sampleAt(2), earlier[2]);
  assert.throws(() => wind.advanceTo(10), RangeError);
});

test('wind follows the unpaused pond clock and a new visit starts a fresh recording', () => {
  const pond = new PondSimulation(15);
  pond.animals = [];
  for (let frame = 0; frame < 25; frame++) pond.step(0.1);
  const state = pond.wind.current;
  const history = [...pond.wind.history];
  pond.paused = true;
  for (let frame = 0; frame < 30; frame++) pond.step(0.1);
  assert.deepEqual(pond.wind.current, state);
  assert.deepEqual(pond.wind.history, history);
  assert.equal(pond.wind.current.time, pond.elapsed);
  pond.paused = false;
  pond.step(0.1);
  assert.ok(pond.wind.current.time > state.time);
  assert.deepEqual(state, pond.wind.sampleAt(state.time));
  const nextVisit = new PondSimulation(16);
  assert.equal(nextVisit.wind.current.time, 0);
  assert.equal(nextVisit.wind.history.length, 1);
});

test('shimmer particles drift with the shared wind, freeze with zero elapsed time, and recycle within the pond', () => {
  const shimmer = new WaterShimmer(80);
  const particle = shimmer.particles.find(value => value.lifetime - value.age > 1)!;
  const before = { ...particle };
  const east = { time: 0, direction: 0, strength: 0.5, x: 0.5, y: 0 };
  shimmer.step(0.1, east);
  assert.ok(particle.x > before.x);
  assert.equal(particle.y, before.y);
  const x = particle.x;
  shimmer.step(0.1, { ...east, direction: Math.PI / 2, x: 0, y: 0.5 });
  assert.equal(particle.x, x);
  assert.ok(particle.y > before.y);
  const paused = shimmer.particles.map(value => ({ ...value }));
  shimmer.step(0, east);
  assert.deepEqual(shimmer.particles, paused);
  const wind = new WindSimulation(80);
  for (let frame = 0; frame < 2400; frame++) {
    shimmer.step(0.05, wind.sampleAt(frame * 0.05));
    assert.ok(shimmer.particles.every(value => inPond(value) && value.age < value.lifetime));
  }
  assert.equal(shimmer.particles.length, paused.length);
});
