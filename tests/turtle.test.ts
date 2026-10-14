import test from 'node:test';
import assert from 'node:assert/strict';
import { PondSimulation, SPECIES, TURTLE_SURFACE_SECONDS, animalCollisionRadius, type Food } from '../src/simulation.ts';
import { turtleSurfaceAmount } from '../src/turtle.ts';
import { LUCKY_BONUS_POINTS } from '../src/throws.ts';

function quietTurtle() {
  const pond = new PondSimulation(42);
  const turtle = pond.animals.find(animal => animal.profile.kind === 'turtle')!;
  pond.animals = [turtle];
  Object.assign(turtle, { x: 600, y: 389, heading: 0, phase: 0, destination: { x: 900, y: 389 } });
  return { pond, turtle };
}
function foodAt(x = 600, y = 389): Food {
  return { id: 99, x, y, origin: { x, y }, launchHeight: 0, target: { x, y }, amount: 1,
    age: 3, phase: 'water', flightTime: 0, flightDuration: 10, height: 0,
    releaseAt: 0, arcScale: 1, lucky: false, bonusClaimed: false };
}
function advance(pond: PondSimulation, seconds: number): void {
  for (let tick = 0; tick < Math.round(seconds / 0.05); tick++) pond.step(0.05);
}

test('one secret musk turtle ambles slowly without surfacing or appearing in the guide', () => {
  const full = new PondSimulation(42);
  assert.equal(full.animals.filter(animal => animal.profile.kind === 'turtle').length, 1);
  assert.equal(SPECIES.some(profile => profile.kind === 'turtle'), false);
  const { pond, turtle } = quietTurtle();
  advance(pond, 10);
  const traveled = Math.hypot(turtle.x - 600, turtle.y - 389);
  assert.ok(traveled > 40 && traveled < 60);
  assert.ok(turtle.profile.speed < Math.min(...SPECIES.map(profile => profile.speed)));
  assert.equal(turtle.surfaceLeft, 0);
  assert.equal(turtleSurfaceAmount(turtle), 0);
});

test('the turtle ignores airborne and unreleased pellets, then slowly approaches a submerged one', () => {
  const { pond, turtle } = quietTurtle();
  pond.food = [{ ...foodAt(), phase: 'air', age: 0 }];
  advance(pond, 1);
  assert.equal(turtle.state, 'roaming');
  assert.equal(turtle.surfaceLeft, 0);
  assert.equal(pond.turtleFood, 0);
  pond.food = [{ ...foodAt(turtle.x, turtle.y), releaseAt: pond.elapsed + 5 }];
  pond.step(0.05);
  assert.equal(pond.turtleFood, 0);
  pond.food = [foodAt(turtle.x + 50, turtle.y)];
  const before = { x: turtle.x, y: turtle.y };
  advance(pond, 1);
  const traveled = Math.hypot(turtle.x - before.x, turtle.y - before.y);
  assert.equal(turtle.state, 'approaching');
  assert.ok(traveled > 15 && traveled <= 18.001);
  advance(pond, 3);
  assert.ok(pond.turtleFood > 0);
  assert.ok(turtle.surfaceLeft > 0);
});

test('a real nibble raises the head, holds it still, and eases it below the water before roaming', () => {
  const { pond, turtle } = quietTurtle();
  pond.food = [{ ...foodAt(), amount: 0.2 }];
  pond.step(0.05);
  assert.equal(pond.turtleFood, 0.2);
  assert.equal(pond.food.length, 0);
  assert.equal(turtle.surfaceLeft, TURTLE_SURFACE_SECONDS);
  assert.equal(turtleSurfaceAmount(turtle), 0);
  assert.equal(pond.bites[0].kind, 'turtle');
  advance(pond, 0.2);
  assert.ok(turtleSurfaceAmount(turtle) > 0 && turtleSurfaceAmount(turtle) < 1);
  advance(pond, 0.3);
  assert.equal(turtleSurfaceAmount(turtle), 1);
  const frozen = JSON.stringify(turtle);
  pond.paused = true; advance(pond, 8);
  assert.equal(JSON.stringify(turtle), frozen);
  pond.paused = false;
  advance(pond, 4);
  assert.ok(turtleSurfaceAmount(turtle) > 0 && turtleSurfaceAmount(turtle) < 1);
  assert.equal(turtle.x, 600); assert.equal(turtle.y, 389);
  advance(pond, 1);
  assert.equal(turtleSurfaceAmount(turtle), 0);
  advance(pond, 1);
  assert.equal(turtle.state, 'roaming');
  assert.ok(turtle.x > 600);
});

test('turtle bites conserve food and earn kindness without counting as fish or claiming their lucky bonus', () => {
  const { pond, turtle } = quietTurtle();
  const pellet = { ...foodAt(), lucky: true };
  pond.food = [pellet];
  pond.step(0.05);
  assert.equal(pond.score, 4);
  assert.equal(pond.eatenFood, 0.4);
  assert.equal(pond.fedFish.size, 0);
  assert.equal(pond.fishFood, 0); assert.equal(pond.birdFood, 0);
  assert.equal(pond.fishShare, 0);
  assert.equal(pond.luckyBonus, 0); assert.equal(pellet.bonusClaimed, false);
  const fish = new PondSimulation(42).animals.find(animal => animal.profile.id === 'minnow')!;
  Object.assign(fish, { x: 600, y: 389 });
  pond.animals.push(fish);
  pond.step(0.05);
  assert.equal(pond.luckyBonus, LUCKY_BONUS_POINTS);
  assert.equal(pond.fedFish.size, 1);
  assert.ok(Math.abs(pond.fishShare - 0.3 / 0.7) < 0.000001);
  assert.ok(Math.abs(pond.eatenFood + pond.food[0].amount - 1) < 0.000001);
  assert.equal(turtle.surfaceLeft, turtle.surfaceDuration - 0.05);
});

test('the turtle keeps body space from fish while birds float above it', () => {
  for (const kind of ['fish', 'bird'] as const) {
    const { pond, turtle } = quietTurtle();
    const other = new PondSimulation(42).animals.find(animal => animal.profile.kind === kind)!;
    Object.assign(other, { x: 600, y: 389, chewLeft: 30 });
    turtle.chewLeft = 30;
    pond.animals.push(other);
    pond.step(0.05);
    const gap = Math.hypot(turtle.x - other.x, turtle.y - other.y);
    if (kind === 'fish') assert.ok(gap >= animalCollisionRadius(turtle) + animalCollisionRadius(other) - 0.001);
    else assert.equal(gap, 0);
  }
});
