import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { PondSimulation, POND, flightPosition, inPond, type Point } from '../src/simulation.ts';
import type { ThrowAnimation } from '../src/throws.ts';

function throwFood(animation: ThrowAnimation = 'toss', point: Point = POND): PondSimulation {
  const pond = new PondSimulation(80, () => 0.5);
  pond.animals = []; pond.handfuls = 2;
  pond.nextThrow = { animation, lucky: false };
  assert.equal(pond.scatter(point), true);
  return pond;
}

function setWind(t: TestContext, pond: PondSimulation, vector: Point | ((time: number) => Point)): void {
  t.mock.method(pond.wind, 'sampleAt', (time: number) => {
    const { x, y } = typeof vector === 'function' ? vector(time) : vector;
    return { time, x, y, strength: Math.hypot(x, y), direction: (Math.atan2(y, x) + Math.PI * 2) % (Math.PI * 2) };
  });
}

function advanceTo(pond: PondSimulation, time: number, step = 1 / 60): void {
  while (time - pond.elapsed > 1e-10) pond.step(Math.min(step, time - pond.elapsed));
}

test('airborne food bends with either wind axis, while calm air preserves the original arc', t => {
  const calm = throwFood();
  setWind(t, calm, { x: 0, y: 0 });
  const initial = structuredClone(calm.food[0]);
  const halfway = initial.releaseAt + initial.flightDuration / 2;
  advanceTo(calm, halfway);
  const expected = flightPosition(initial, initial.flightDuration / 2);
  assert.ok(Math.abs(calm.food[0].x - expected.x) < 1e-8);
  assert.ok(Math.abs(calm.food[0].y - expected.y) < 1e-8);
  assert.deepEqual(calm.food[0].target, initial.target);

  for (const vector of [{ x: 0.6, y: 0 }, { x: -0.6, y: 0 }, { x: 0, y: 0.6 }, { x: 0, y: -0.6 }]) {
    const pond = throwFood();
    setWind(t, pond, vector);
    advanceTo(pond, halfway);
    const food = pond.food[0];
    assert.equal(food.phase, 'air');
    assert.ok((food.x - expected.x) * vector.x + (food.y - expected.y) * vector.y > 2);
    assert.ok((food.target.x - initial.target.x) * vector.x + (food.target.y - initial.target.y) * vector.y > 4);
    assert.deepEqual(food.origin, initial.origin, 'The wind must not move the release hand');
  }
});

test('stronger gusts and longer overhand flights create more drift, with a single splash at the shifted point', t => {
  const drift = (animation: ThrowAnimation, strength: number) => {
    const pond = throwFood(animation);
    setWind(t, pond, { x: strength, y: 0 });
    const food = pond.food[0];
    const aim = { ...food.target };
    advanceTo(pond, Math.max(...pond.food.map(pellet => pellet.releaseAt + pellet.flightDuration)) + 0.05);
    assert.equal(food.phase, 'water');
    assert.equal(food.height, 0);
    assert.equal(pond.splashes.length, 4);
    for (const splash of pond.splashes) {
      const pellet = pond.food.find(pellet => pellet.id === splash.food)!;
      assert.deepEqual({ x: splash.x, y: splash.y }, pellet.target);
      assert.ok(inPond(splash));
    }
    const landing = { ...food.target };
    advanceTo(pond, pond.elapsed + 1);
    assert.deepEqual(food.target, landing, 'Airborne wind drift stops at the water');
    assert.equal(pond.splashes.length, 4);
    return landing.x - aim.x;
  };
  const weak = drift('toss', 0.2);
  const strong = drift('toss', 0.6);
  assert.ok(weak > 5 && strong > weak * 2.9);
  assert.ok(drift('overhand', 0.6) > strong * 1.2);
});

test('pellets respond to a wind change during flight, freeze on pause, and queued food waits for its own release', t => {
  const pond = throwFood();
  setWind(t, pond, time => ({ x: time < 0.5 ? 0.5 : -0.5, y: 0 }));
  pond.scatter(POND);
  const first = pond.food[0], queued = pond.food[4];
  const initial = structuredClone(pond.food);
  advanceTo(pond, first.releaseAt);
  assert.deepEqual(pond.food, initial, 'No wind drift occurs before release');
  advanceTo(pond, 0.5);
  const east = first.target.x;
  assert.ok(east > initial[0].target.x);
  advanceTo(pond, 0.75);
  assert.ok(first.target.x < east, 'A new gust changes an already airborne throw');
  assert.deepEqual(queued, initial[4]);
  pond.paused = true;
  const frozen = structuredClone({ food: pond.food, wind: pond.wind.current, history: pond.wind.history });
  for (let frame = 0; frame < 60; frame++) pond.step(0.05);
  assert.deepEqual({ food: pond.food, wind: pond.wind.current, history: pond.wind.history }, frozen);
  pond.paused = false;
  advanceTo(pond, queued.releaseAt + 0.1);
  assert.ok(queued.target.x < initial[4].target.x, 'Queued throws use the wind at release, not at the click');
  assert.ok(pond.wind.history[1].x < 0);
});

test('recorded weather reproduces wind-shifted landings across frame rates and partial flight frames', () => {
  const run = (step: number) => {
    const pond = throwFood('overhand');
    pond.scatter({ x: 720, y: 330 });
    advanceTo(pond, 4.125, step);
    assert.equal(pond.splashes.length, 8);
    return pond;
  };
  const reference = run(1 / 120);
  for (const step of [1 / 30, 0.1]) {
    const pond = run(step);
    assert.deepEqual(pond.wind.history, reference.wind.history);
    for (const splash of pond.splashes) {
      const expected = reference.splashes.find(other => other.food === splash.food)!;
      assert.ok(Math.hypot(splash.x - expected.x, splash.y - expected.y) < 0.01,
        'The same recorded wind must land a throw within a hundredth of a pixel across frame rates');
    }
  }
});

test('outward gusts keep every throw inside the curved shoreline without losing food or duplicating splashes', t => {
  for (const animation of ['toss', 'overhand', 'spread'] as const) {
    for (let side = 0; side < 8; side++) {
      const angle = side * Math.PI / 4;
      const vector = { x: Math.cos(angle), y: Math.sin(angle) };
      const point = { x: POND.x + POND.rx * vector.x * 0.999, y: POND.y + POND.ry * vector.y * 0.999 };
      const pond = throwFood(animation, point);
      setWind(t, pond, vector);
      const end = Math.max(...pond.food.map(food => food.releaseAt + food.flightDuration)) + 0.1;
      while (pond.elapsed < end) {
        pond.step(0.1);
        assert.ok(pond.food.every(food => inPond(food.target)));
      }
      assert.equal(pond.food.length, 4);
      assert.equal(pond.food.reduce((sum, food) => sum + food.amount, 0), 4);
      assert.ok(pond.food.every(food => food.phase === 'water' && inPond(food)));
      assert.equal(new Set(pond.splashes.map(splash => splash.food)).size, 4);
      assert.equal(pond.splashes.length, 4);
    }
  }
});
