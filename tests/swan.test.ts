import test from 'node:test';
import assert from 'node:assert/strict';
import { PondSimulation, POND, SPECIES, inPond, type Animal, type Food } from '../src/simulation.ts';
import { SWAN, SwanVisit } from '../src/swan.ts';

function advance(pond: PondSimulation, seconds: number): void {
  for (let t = 0; t < seconds - 1e-8; t += .05) pond.step(Math.min(.05, seconds - t));
}
function pellet(animal: Animal, id: number, amount = 1): Food {
  const point = { x: animal.x, y: animal.y };
  return { ...point, id, throwId: id, amount, age: 0, phase: 'water', origin: point, target: point,
    launchHeight: 0, flightTime: 1, flightDuration: 1, height: 0, releaseAt: 0, arcScale: 1,
    lucky: false, bonusClaimed: false };
}
function quietPond(seed = 801): { pond: PondSimulation; turtle: Animal } {
  const pond = new PondSimulation(seed);
  const turtle = pond.animals.find(a => a.profile.kind === 'turtle')!;
  Object.assign(turtle, { x: 600, y: 389, destination: { x: 850, y: 389 } });
  pond.animals = [turtle];
  return { pond, turtle };
}
function feedTurtle(pond: PondSimulation, turtle: Animal): void {
  pond.food = [pellet(turtle, 1, .2)]; pond.step(.05);
  assert.ok(pond.turtleFood > 0); pond.food = [];
}
function waitForSwan(pond: PondSimulation): Animal {
  advance(pond, pond.swan.arrivesAt! - pond.elapsed + .05);
  const swan = pond.animals.find(a => a.profile.id === SWAN.id)!;
  assert.ok(swan); swan.nextIdleAt = Infinity;
  return swan;
}
function feedSwan(pond: PondSimulation, swan: Animal, id: number, amount = 1): void {
  swan.idle = null;
  pond.food = [pellet(swan, id, amount)]; pond.step(.05);
  assert.equal(swan.state, 'chewing'); pond.food = [];
}

test('the swan is absent until a real turtle bite schedules a 10–15-second delay', () => {
  const { pond, turtle } = quietPond();
  assert.equal(SPECIES.some(p => p.id === SWAN.id), false);
  advance(pond, 60);
  assert.equal(pond.swan.phase, 'away'); assert.equal(pond.animals.length, 1);
  pond.handfuls = 1; pond.scatter({ x: 600, y: 389 });
  assert.equal(pond.swan.phase, 'away'); pond.food = [];
  pond.food = [{ ...pellet(turtle, 1), releaseAt: pond.elapsed + 10 }]; pond.step(.05);
  assert.equal(pond.swan.phase, 'away');
  feedTurtle(pond, turtle);
  const scheduled = pond.swan.arrivesAt!;
  assert.ok(scheduled >= pond.elapsed + 10 && scheduled <= pond.elapsed + 15);
  assert.equal(pond.swan.phase, 'waiting');
  advance(pond, scheduled - pond.elapsed - .1);
  assert.equal(pond.animals.length, 1);
  const swan = waitForSwan(pond);
  assert.equal(pond.swan.phase, 'arriving'); assert.equal(swan.flight?.passage, 'arrival');
  assert.equal(pond.birdSplashes.length, 0, 'Arrival has no offscreen takeoff splash');
  assert.ok(!inPond(swan)); assert.ok(swan.altitude > 0);
  const destination = { ...swan.flight!.destination };
  advance(pond, swan.flight!.duration);
  assert.equal(pond.swan.phase, 'visiting'); assert.equal(swan.flight, null);
  assert.ok(inPond(swan)); assert.equal(swan.altitude, 0);
  assert.ok(Math.hypot(swan.x - destination.x, swan.y - destination.y) < 3);
  assert.deepEqual(pond.birdSplashes.map(s => s.phase), ['landing']);
});

test('two actual bites finish their meals before one departure, and more food cannot hold the swan', () => {
  const { pond, turtle } = quietPond(802); feedTurtle(pond, turtle);
  const swan = waitForSwan(pond); advance(pond, swan.flight!.duration + .1);
  pond.birdSplashes = [];
  feedSwan(pond, swan, 2, .3);
  assert.equal(pond.swan.meals, 1);
  advance(pond, swan.chewLeft + .1);
  assert.equal(pond.swan.phase, 'visiting'); assert.equal(swan.flight, null);
  feedSwan(pond, swan, 3, .7);
  assert.equal(pond.swan.meals, 2); assert.equal(swan.totalEaten, 1);
  const secondMeal = swan.chewLeft;
  pond.food = [pellet(swan, 4, 10)];
  advance(pond, secondMeal - .1);
  assert.equal(pond.swan.phase, 'visiting'); assert.equal(swan.flight, null);
  advance(pond, .2);
  assert.equal(pond.swan.phase, 'departing'); assert.equal(swan.flight?.passage, 'departure');
  assert.equal(swan.totalEaten, 1); assert.equal(pond.birdFood, 1);
  while (pond.animals.includes(swan)) {
    pond.step(.05);
    if (pond.animals.includes(swan)) { assert.ok(swan.flight); assert.notEqual(swan.state, 'landing'); }
  }
  assert.equal(pond.swan.phase, 'away'); assert.equal(pond.swan.animalId, null);
  assert.ok(!inPond(swan)); assert.ok(swan.altitude > 0);
  assert.deepEqual(pond.birdSplashes.map(s => s.phase), ['takeoff']);
});

test('turtle feedings cannot postpone or queue visits, and a fresh feeding after departure invites one return', () => {
  const { pond, turtle } = quietPond(803); feedTurtle(pond, turtle);
  const scheduled = pond.swan.arrivesAt;
  advance(pond, 6); feedTurtle(pond, turtle);
  assert.equal(pond.swan.arrivesAt, scheduled);
  const swan = waitForSwan(pond); advance(pond, swan.flight!.duration + .1);
  turtle.chewLeft = 0; turtle.meal = null; turtle.surfaceLeft = 0;
  feedTurtle(pond, turtle);
  assert.equal(pond.swan.phase, 'visiting'); assert.equal(pond.swan.arrivesAt, null);
  feedSwan(pond, swan, 3); advance(pond, swan.chewLeft + .1);
  feedSwan(pond, swan, 4); advance(pond, swan.chewLeft + .1);
  assert.equal(pond.swan.phase, 'departing');
  turtle.chewLeft = 0; turtle.meal = null; turtle.surfaceLeft = 0; feedTurtle(pond, turtle);
  advance(pond, swan.flight!.duration + 20);
  assert.equal(pond.swan.phase, 'away'); assert.equal(pond.animals.filter(a => a.profile.id === SWAN.id).length, 0);
  feedTurtle(pond, turtle);
  assert.equal(pond.swan.phase, 'waiting');
  const returning = waitForSwan(pond);
  assert.notEqual(returning.id, swan.id);
  assert.equal(pond.swan.meals, 0); assert.equal(returning.totalEaten, 0);
  assert.equal(pond.animals.filter(a => a.profile.id === SWAN.id).length, 1);
});

test('pause freezes the invitation, arrival, meals and departure; a fresh visit starts without a swan', () => {
  const { pond, turtle } = quietPond(804); feedTurtle(pond, turtle);
  const pause = () => {
    const before = JSON.stringify([pond.elapsed, pond.swan, pond.animals]);
    pond.paused = true; advance(pond, 20); pond.step(0);
    assert.equal(JSON.stringify([pond.elapsed, pond.swan, pond.animals]), before);
    pond.paused = false;
  };
  pause(); const swan = waitForSwan(pond); pause();
  advance(pond, swan.flight!.duration + .1);
  feedSwan(pond, swan, 2); pause(); advance(pond, swan.chewLeft + .1);
  feedSwan(pond, swan, 3); advance(pond, swan.chewLeft + .1); pause();
  const fresh = new PondSimulation(804);
  assert.equal(fresh.swan.phase, 'away'); assert.equal(fresh.swan.arrivesAt, null);
  assert.equal(fresh.animals.some(a => a.profile.id === SWAN.id), false);
});

test('the invitation and route use independent randomness, and delay endpoints stay in range', () => {
  for (const roll of [0, .999999]) {
    const visit = new SwanVisit(() => roll);
    visit.noticeTurtleMeal(20);
    assert.ok(visit.arrivesAt! >= 30 && visit.arrivesAt! < 35);
    assert.equal(visit.beginArrival(29.99, POND), null);
    const route = visit.beginArrival(35, POND)!;
    assert.ok(inPond(route.destination)); assert.ok(!inPond(route.origin));
    assert.equal(visit.beginArrival(40, POND), null);
  }
  const invited = new PondSimulation(805), ordinary = new PondSimulation(805);
  invited.swan.noticeTurtleMeal(0); invited.swan.beginArrival(15, POND);
  for (const pond of [invited, ordinary]) { pond.handfuls = 2; pond.scatter({ x: 600, y: 389 }); }
  assert.deepEqual(invited.lastThrow, ordinary.lastThrow);
  assert.deepEqual(invited.nextThrow, ordinary.nextThrow);
  assert.deepEqual(invited.food, ordinary.food);
});
