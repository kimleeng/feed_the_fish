import test from 'node:test';
import assert from 'node:assert/strict';
import { debugMetrics } from '../src/debug-metrics.ts';
import { FLOAT_SECONDS, PondSimulation, type Food } from '../src/simulation.ts';

function food(id: number): Food {
  return { id, throwId: id, x: 600, y: 389, origin: { x: 600, y: 389 }, target: { x: 600, y: 389 },
    amount: 1, age: 0, phase: 'water', launchHeight: 0, flightTime: 1, flightDuration: 1,
    height: 0, releaseAt: 0, arcScale: 1, lucky: false, bonusClaimed: false };
}

test('debug metrics distinguish queued, airborne, floating, and underwater pellets and expose real animal history', () => {
  const world = new PondSimulation(41);
  world.elapsed = 40;
  const koi = world.animals.find(animal => animal.profile.id === 'koi')!;
  const carp = world.animals.find(animal => animal.profile.id === 'carp')!;
  const gull = world.animals.find(animal => animal.profile.id === 'gull')!;
  const turtle = world.animals.find(animal => animal.profile.kind === 'turtle')!;
  world.animals = [koi, carp, gull, turtle];
  Object.assign(koi, { lastAteAt: 30, totalEaten: 1.5, boostCharge: 0.5, boosting: true, state: 'approaching' });
  Object.assign(carp, { lastAteAt: 20, totalEaten: 0.65 });
  gull.state = 'taking-off';
  gull.flight = { origin: { x: 300, y: 389 }, destination: { x: 500, y: 389 }, elapsed: 0.1, duration: 1.5 };
  world.food = [
    { ...food(0), phase: 'air', releaseAt: 41 },
    { ...food(1), phase: 'air' },
    { ...food(2), age: FLOAT_SECONDS },
    { ...food(3), age: FLOAT_SECONDS + 0.01 },
    { ...food(4), amount: 0 },
  ];
  const before = JSON.stringify(world);
  const metrics = debugMetrics(world);
  assert.equal(JSON.stringify(world), before);
  assert.deepEqual(metrics.pellets, { queued: 1, air: 1, floating: 1, underwater: 1 });
  assert.equal(metrics.hungry, 3); assert.equal(metrics.recentlyFed, 1);
  assert.equal(metrics.boosting, 1); assert.equal(metrics.airborneBirds, 1);
  assert.deepEqual(metrics.animals[0], { id: koi.id, name: koi.profile.name, kind: 'fish', state: 'approaching',
    hungry: false, boostCharge: 0.5, boosting: true, secondsSinceMeal: 10, totalEaten: 1.5, basePace: 30 });
  assert.equal(metrics.animals[1].hungry, true, 'The recent-meal window ends at 20 seconds.');
  assert.equal(metrics.animals[2].secondsSinceMeal, null);
  assert.equal(metrics.animals[3].boostCharge, null, 'The turtle has no swimming boost.');
  koi.boostCharge = 0.75; world.food[2].age += 1;
  assert.equal(metrics.animals[0].boostCharge, 0.5);
  assert.equal(metrics.pellets.floating, 1, 'Published snapshots retain their sampled values.');
});

test('a fresh visit reports all animals hungry with clear meal and pellet metrics', () => {
  const world = new PondSimulation(41);
  const metrics = debugMetrics(world);
  assert.equal(metrics.animals.length, 62);
  assert.equal(metrics.hungry, 62); assert.equal(metrics.recentlyFed, 0);
  assert.equal(metrics.boosting, 0); assert.equal(metrics.airborneBirds, 0);
  assert.deepEqual(metrics.pellets, { queued: 0, air: 0, floating: 0, underwater: 0 });
  assert.ok(metrics.animals.every(animal => animal.secondsSinceMeal === null && animal.totalEaten === 0
    && (animal.kind === 'turtle' ? animal.boostCharge === null : animal.boostCharge === 1)));
});
