import test from 'node:test';
import assert from 'node:assert/strict';
import { PondSimulation, SPECIES, MUSK_TURTLE, type AnimalProfile, type Food } from '../src/simulation.ts';
import { eatingDuration, eatingFrame, eatingStage, fishSurfaceAmount, fishSurfaceFrame } from '../src/eating.ts';
import { turtleSurfaceAmount } from '../src/turtle.ts';

function feed(profile: AnimalProfile, portion = 1) {
  const pond = new PondSimulation(42);
  const animal = pond.animals.find(animal => animal.profile.id === profile.id)!;
  Object.assign(animal, { x: 600, y: 389, heading: 0 });
  pond.animals = [animal];
  const food: Food = { id: 99, throwId: 99, x: 600, y: 389, origin: { x: 600, y: 389 }, target: { x: 600, y: 389 },
    amount: profile.bite * portion, age: 0, phase: 'water', launchHeight: 0, flightTime: 1, flightDuration: 1,
    height: 0, releaseAt: 0, arcScale: 1, lucky: false, bonusClaimed: false };
  pond.food = [food]; pond.step(0.01);
  return { pond, animal };
}

function advance(pond: PondSimulation, duration: number, step = 1 / 60) {
  let remaining = duration;
  while (remaining > 1e-9) { const dt = Math.min(step, remaining); pond.step(dt); remaining -= dt; }
}

test('every species starts its own eating animation on a real bite and finishes after its meal', () => {
  for (const profile of [...SPECIES, MUSK_TURTLE]) {
    const { pond, animal } = feed(profile);
    assert.equal(animal.meal?.duration, profile.chew);
    assert.equal(eatingStage(animal), 'bite');
    assert.equal(eatingFrame(animal, 'e'), `${profile.texture}-e-bite`);
    const stages = new Set();
    for (let time = 0; time < profile.chew - 0.01; time += 0.01) {
      stages.add(eatingStage(animal));
      assert.equal(animal.moving, false);
      assert.equal(pond.bites.length, 1);
      pond.step(0.01);
    }
    assert.deepEqual([...stages].sort(), ['bite', 'chew', 'rest', 'swallow']);
    advance(pond, 0.02);
    assert.equal(animal.chewLeft, 0);
    assert.equal(animal.meal, null);
    assert.equal(eatingFrame(animal, 'e'), null);
    assert.equal(pond.eatenFood, profile.bite);
  }
});

test('small scraps take less eating time while keeping the species pace and a readable bite and swallow', () => {
  for (const profile of [...SPECIES, MUSK_TURTLE]) {
    const { pond, animal } = feed(profile, 0.1);
    const duration = animal.meal!.duration;
    assert.ok(duration < profile.chew && duration >= profile.chew * 0.55);
    assert.equal(duration, eatingDuration(profile, profile.bite * 0.1));
    advance(pond, duration - 0.001);
    assert.equal(animal.state, 'chewing');
    advance(pond, 0.002);
    assert.equal(animal.meal, null);
    assert.ok(Math.abs(pond.eatenFood - profile.bite * 0.1) < 1e-9);
  }
});

test('repeated mouth movements do not take more food or score, and a new meal waits for the first one to finish', () => {
  const profile = SPECIES.find(profile => profile.id === 'minnow')!;
  const { pond, animal } = feed(profile);
  pond.food.push({ id: 100, throwId: 100, x: 600, y: 389, origin: { x: 600, y: 389 }, target: { x: 600, y: 389 },
    amount: 1, age: 0, phase: 'water', launchHeight: 0, flightTime: 1, flightDuration: 1,
    height: 0, releaseAt: 0, arcScale: 1, lucky: true, bonusClaimed: false });
  advance(pond, profile.chew - 0.001);
  assert.equal(pond.bites.length, 1); assert.equal(pond.score, 3);
  assert.equal(pond.food[0].amount, 1);
  advance(pond, 0.05);
  assert.equal(pond.bites.length, 2); assert.equal(pond.score, 56);
  assert.equal(animal.meal?.duration, profile.chew);
  assert.ok(Math.abs(pond.eatenFood + pond.food[0].amount - 1.3) < 1e-9);
});

test('the meal clock and pose freeze with the pond and finish consistently at different frame rates', () => {
  for (const step of [1 / 30, 1 / 60, 1 / 144]) {
    const { pond, animal } = feed(SPECIES[0]);
    advance(pond, 0.5, step);
    const frozen = JSON.stringify(animal), pose = eatingFrame(animal, 'w');
    pond.paused = true; advance(pond, 10, step);
    assert.equal(JSON.stringify(animal), frozen); assert.equal(eatingFrame(animal, 'w'), pose);
    pond.paused = false;
    advance(pond, animal.meal!.duration - 0.5 - 0.001, step);
    assert.equal(animal.state, 'chewing');
    advance(pond, 0.002, step);
    assert.equal(animal.meal, null);
    assert.equal(eatingStage(animal), null);
  }
});

test('the turtle stays surfaced through its slow swallow and dips only after the meal', () => {
  const { pond, animal } = feed(MUSK_TURTLE);
  advance(pond, 0.5);
  assert.equal(turtleSurfaceAmount(animal), 1);
  advance(pond, MUSK_TURTLE.chew - 0.5 - 0.01);
  assert.equal(turtleSurfaceAmount(animal), 1);
  advance(pond, 0.4);
  assert.equal(animal.meal, null);
  assert.ok(turtleSurfaceAmount(animal) > 0 && turtleSurfaceAmount(animal) < 1);
  assert.equal(animal.moving, false);
  advance(pond, 0.5);
  assert.equal(turtleSurfaceAmount(animal), 0);
});

test('all carp rise for a real meal, keep working their mouths at the surface, and sink smoothly before moving on', () => {
  for (const profile of SPECIES.filter(profile => profile.kind === 'fish')) for (const portion of [1, .1]) {
    const { pond, animal } = feed(profile, portion);
    const duration = animal.meal!.duration;
    assert.equal(fishSurfaceAmount(animal), 0);
    advance(pond, duration * .05);
    assert.ok(fishSurfaceAmount(animal) > 0 && fishSurfaceAmount(animal) < 1);
    advance(pond, duration * .35);
    assert.equal(fishSurfaceAmount(animal), 1);
    const paused = fishSurfaceAmount(animal), pose = fishSurfaceFrame(animal, 's');
    pond.paused = true; advance(pond, 2);
    assert.equal(fishSurfaceAmount(animal), paused); assert.equal(fishSurfaceFrame(animal, 's'), pose);
    pond.paused = false;
    advance(pond, duration * .56);
    assert.equal(eatingStage(animal), 'rest');
    assert.ok(fishSurfaceAmount(animal) > 0 && fishSurfaceAmount(animal) < 1);
    assert.equal(fishSurfaceFrame(animal, 's'), `${profile.texture}-s-surface-chew`);
    advance(pond, duration * .04);
    assert.equal(fishSurfaceAmount(animal), 0);
    assert.equal(pond.bites.length, 1);
  }
  for (const profile of [...SPECIES.filter(profile => profile.kind === 'bird'), MUSK_TURTLE]) {
    const { pond, animal } = feed(profile); advance(pond, .3);
    assert.equal(fishSurfaceAmount(animal), 0);
  }
});
