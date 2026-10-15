import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnimalEnergy, hasEatenRecently, recordFeeding, stepAnimalBoost,
  BOOST_DURATION_SECONDS, BOOST_SPEED_MULTIPLIER, BOOST_RECHARGE_SECONDS,
  HUNGRY_RECHARGE_MODIFIER, FED_RECHARGE_MODIFIER, type AnimalEnergy } from '../src/animal-energy.ts';
import { PondSimulation, SPECIES, MUSK_TURTLE, type Food } from '../src/simulation.ts';

function close(actual: number, expected: number): void { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`); }
function advanceEnergy(animal: AnimalEnergy, seconds: number, start = 0, pursuing = false, frame = 0.05): number {
  let time = 0, traveled = 0;
  while (time < seconds - 1e-9) {
    const dt = Math.min(frame, seconds - time);
    time += dt;
    traveled += stepAnimalBoost(animal, start + time, dt, pursuing) * dt;
  }
  return traveled;
}
function foodAt(x: number, y: number): Food {
  return { id: 1, throwId: 1, x, y, origin: { x, y }, target: { x, y }, amount: 1, age: 0,
    phase: 'water', launchHeight: 0, flightTime: 1, flightDuration: 1, height: 0,
    releaseAt: 0, arcScale: 1, lucky: false, bonusClaimed: false };
}

test('a full reserve gives a two-second, 40% burst consistently across frame rates', () => {
  for (const frame of [1 / 30, 1 / 60, 1 / 144]) {
    const animal = createAnimalEnergy();
    assert.equal(animal.lastAteAt, null);
    assert.equal(animal.totalEaten, 0);
    const traveled = advanceEnergy(animal, BOOST_DURATION_SECONDS, 0, true, frame);
    close(traveled, BOOST_DURATION_SECONDS * BOOST_SPEED_MULTIPLIER);
    close(animal.boostCharge, 0);
    assert.equal(animal.boosting, false);
  }
});

test('recharge modifiers give 15 seconds hungry and a 30-second rate while recently fed', () => {
  assert.equal(BOOST_RECHARGE_SECONDS / HUNGRY_RECHARGE_MODIFIER, 15);
  assert.equal(BOOST_RECHARGE_SECONDS / FED_RECHARGE_MODIFIER, 30);
  const hungry = { ...createAnimalEnergy(), boostCharge: 0 };
  advanceEnergy(hungry, 14.9);
  assert.ok(hungry.boostCharge < 1);
  advanceEnergy(hungry, 0.1, 14.9);
  close(hungry.boostCharge, 1);

  const fed = { ...createAnimalEnergy(), boostCharge: 0 };
  for (let second = 0; second < 30; second++) {
    recordFeeding(fed, 0.1, second);
    advanceEnergy(fed, 1, second);
    close(fed.boostCharge, (second + 1) / 30);
  }
});

test('hunger returns 20 seconds after the latest bite, including a frame across the boundary', () => {
  const animal = { ...createAnimalEnergy(), boostCharge: 0 };
  recordFeeding(animal, 0.3, 0);
  assert.equal(animal.lastAteAt, 0, 'A bite at time zero still counts.');
  assert.equal(hasEatenRecently(animal, 19.999), true);
  assert.equal(hasEatenRecently(animal, 20), false);
  advanceEnergy(animal, 20);
  close(animal.boostCharge, 2 / 3);
  advanceEnergy(animal, 5, 20);
  close(animal.boostCharge, 1);

  animal.boostCharge = 0;
  stepAnimalBoost(animal, 20.05, 0.1, false);
  close(animal.boostCharge, 0.05 / 30 + 0.05 / 15);
  recordFeeding(animal, 0.2, 21);
  close(animal.totalEaten, 0.5);
  assert.equal(hasEatenRecently(animal, 40), true);
  assert.equal(hasEatenRecently(animal, 41), false);
});

test('an empty reserve recharges fully before another chase burst and handles partial frames', () => {
  const animal = { ...createAnimalEnergy(), boostCharge: 0 };
  close(advanceEnergy(animal, 14.95, 0, true), 14.95);
  assert.equal(animal.boosting, false);
  close(stepAnimalBoost(animal, 15.05, 0.1, true), 1.2);
  close(animal.boostCharge, 0.975);
  assert.equal(animal.boosting, true);
  close(stepAnimalBoost(animal, 17.05, 2, true), 1 + 0.4 * 1.95 / 2);
  close(animal.boostCharge, 0.05 / 15);
  assert.equal(animal.boosting, false);
});

test('an interrupted chase keeps its remaining reserve and recharges instead of repeatedly starting tiny bursts', () => {
  const animal = createAnimalEnergy();
  advanceEnergy(animal, 1, 0, true);
  close(animal.boostCharge, 0.5);
  advanceEnergy(animal, 1, 1, false);
  close(animal.boostCharge, 0.5 + 1 / 15);
  assert.equal(animal.boosting, false);
  close(advanceEnergy(animal, 1, 2, true), 1);
  assert.equal(animal.boosting, false);
  const frozen = JSON.stringify(animal);
  stepAnimalBoost(animal, 3, 0, true);
  assert.equal(JSON.stringify(animal), frozen);
});

test('fish and paddling birds move faster on food chases while the turtle keeps its gentle pace', () => {
  for (const species of ['carp', 'duck', 'musk-turtle']) {
    const pond = new PondSimulation(42);
    const animal = pond.animals.find(animal => animal.profile.id === species)!;
    Object.assign(animal, { x: 500, y: 389, heading: 0 });
    pond.animals = [animal]; pond.food = [foodAt(600, 389)];
    pond.step(0.05);
    const boosting = species !== 'musk-turtle';
    assert.equal(animal.state, 'approaching');
    assert.equal(animal.boosting, boosting);
    close(Math.hypot(animal.x - 500, animal.y - 389), animal.profile.speed * 0.05 * (boosting ? 1.4 : 1));
    close(animal.boostCharge, boosting ? 0.975 : 1);
    assert.equal(animal.lastAteAt, null);
  }
});

test('every real bite updates durable feeding history, stops a burst, and survives the meal animation', () => {
  for (const profile of [...SPECIES, MUSK_TURTLE]) {
    const pond = new PondSimulation(42);
    const animal = pond.animals.find(animal => animal.profile.id === profile.id)!;
    Object.assign(animal, { x: 600, y: 389, boosting: true, boostCharge: 0.4 });
    pond.animals = [animal]; pond.food = [foodAt(600, 389)];
    pond.food[0].amount = profile.bite / 2;
    pond.step(0.05);
    const ateAt = pond.elapsed, amount = profile.bite / 2;
    assert.equal(animal.lastAteAt, ateAt);
    assert.equal(animal.totalEaten, amount);
    assert.equal(animal.boosting, false);
    assert.equal(hasEatenRecently(animal, pond.elapsed), true);
    assert.ok(animal.boostCharge > 0.4, 'Eating recharges the reserve rather than resetting it.');
    for (let i = 0; i < 150; i++) pond.step(0.05);
    assert.equal(animal.meal, null);
    assert.equal(animal.lastAteAt, ateAt);
    assert.equal(animal.totalEaten, amount);
    assert.equal(pond.eatenFood, amount);
  }
});

test('waiting under airborne food and roaming conserve boosts, and pause freezes energy and feeding clocks', () => {
  const pond = new PondSimulation(42);
  const bird = pond.animals.find(animal => animal.profile.id === 'duck')!;
  Object.assign(bird, { x: 600, y: 389, heading: 0, boostCharge: 0.5, lastAteAt: 0 });
  pond.animals = [bird];
  pond.food = [{ ...foodAt(600, 389), phase: 'air', flightDuration: 10, flightTime: 5, origin: { x: 600, y: 695 } }];
  pond.wind.sampleAt = time => ({ time, direction: 0, strength: 0, x: 0, y: 0 });
  pond.step(0.05);
  assert.equal(bird.state, 'approaching');
  assert.equal(bird.boosting, false);
  close(bird.boostCharge, 0.5 + 0.05 / 30);
  pond.paused = true;
  const frozen = JSON.stringify({ bird, elapsed: pond.elapsed });
  for (let i = 0; i < 600; i++) pond.step(0.05);
  assert.equal(JSON.stringify({ bird, elapsed: pond.elapsed }), frozen);
  pond.paused = false; pond.food = [];
  pond.step(0.05);
  assert.equal(bird.state, 'roaming');
  assert.equal(bird.boosting, false);
  assert.ok(bird.boostCharge > 0.5 + 0.05 / 30);

  const fresh = new PondSimulation(42);
  assert.ok(fresh.animals.every(animal => animal.lastAteAt === null && animal.totalEaten === 0
    && animal.boostCharge === 1 && !animal.boosting && Object.keys(animal.flightChoices).length === 0));
});
