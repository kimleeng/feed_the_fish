import test from 'node:test';
import assert from 'node:assert/strict';
import { PondSimulation, FLOAT_SECONDS, ROUND_SECONDS, inPond } from '../src/simulation.ts';

test('different animal profiles approach the same food at different speeds', () => {
  const pond = new PondSimulation(1);
  const koi = pond.animals.find(animal => animal.profile.id === 'koi')!;
  const minnow = pond.animals.find(animal => animal.profile.id === 'minnow')!;
  pond.animals = [koi, minnow];
  for (const animal of pond.animals) { animal.x = 400; animal.y = 389; }
  pond.food = [{ id: 0, x: 450, y: 389, age: 1, amount: 1 }];
  pond.step(0.1);
  assert.equal(koi.state, 'approaching');
  assert.equal(minnow.state, 'approaching');
  assert.ok(minnow.x > koi.x);
});

test('food only starts a round when tossed into the pond', () => {
  const pond = new PondSimulation(2);
  assert.equal(pond.scatter({ x: 1, y: 1 }), false);
  assert.equal(pond.handfuls, 60);
  assert.equal(pond.started, false);
  assert.ok(pond.animals.every(inPond));
  assert.equal(pond.scatter({ x: 600, y: 389 }), true);
  assert.equal(pond.food.length, 4);
  assert.equal(pond.handfuls, 59);
});

test('a fish bites, chews before biting again, and gets credited for its actual portion', () => {
  const pond = new PondSimulation(3);
  const fish = pond.animals.find(animal => animal.profile.id === 'minnow')!;
  pond.animals = [fish];
  fish.x = 600; fish.y = 389;
  pond.food = [{ id: 1, x: 600, y: 389, age: 1, amount: 1 }];
  pond.step(0.05);
  assert.equal(fish.state, 'chewing');
  assert.equal(pond.fishFood, fish.profile.bite);
  assert.equal(pond.fedFish.size, 1);
  const remaining = pond.food[0].amount;
  for (let i = 0; i < 5; i++) pond.step(0.1);
  assert.equal(pond.food[0].amount, remaining);
  for (let i = 0; i < 5; i++) pond.step(0.1);
  assert.ok(pond.fishFood > fish.profile.bite);
  assert.ok(pond.fishFood <= 1);
});

test('birds eat floating food but cannot take food after it sinks', () => {
  const pond = new PondSimulation(4);
  const bird = pond.animals.find(animal => animal.profile.id === 'gull')!;
  bird.x = 600; bird.y = 389; pond.animals = [bird];
  pond.food = [{ id: 1, x: 600, y: 389, age: FLOAT_SECONDS + 0.1, amount: 1 }];
  pond.step(0.05);
  assert.equal(pond.birdFood, 0);
  pond.food[0].age = 0;
  pond.step(0.05);
  assert.equal(pond.birdFood, 1);
  assert.equal(pond.food.length, 0);
  assert.equal(pond.fishShare, 0);
});

test('pause freezes food, animals, and the clock; a completed round blocks more food', () => {
  const pond = new PondSimulation(5);
  pond.scatter({ x: 600, y: 389 });
  pond.paused = true;
  const before = JSON.stringify({ food: pond.food, animals: pond.animals, elapsed: pond.elapsed });
  pond.step(0.1);
  assert.equal(JSON.stringify({ food: pond.food, animals: pond.animals, elapsed: pond.elapsed }), before);
  assert.equal(pond.scatter({ x: 600, y: 389 }), false);
  pond.paused = false;
  pond.elapsed = ROUND_SECONDS - 0.05;
  pond.step(0.1);
  assert.equal(pond.finished, true);
  assert.equal(pond.scatter({ x: 600, y: 389 }), false);
});

test('a full competitive round conserves food and keeps animals in the water', () => {
  const pond = new PondSimulation(6);
  for (let i = 0; i < 10; i++) pond.scatter(i % 2 ? { x: 1097, y: 389 } : { x: 600, y: 389 });
  for (let i = 0; i < 910; i++) pond.step(0.1);
  assert.equal(pond.finished, true);
  assert.ok(pond.fishFood > 0);
  assert.ok(pond.fishFood + pond.birdFood <= 40.000001);
  assert.ok(pond.animals.every(inPond));
  assert.ok(pond.fishShare >= 0 && pond.fishShare <= 1);
});
