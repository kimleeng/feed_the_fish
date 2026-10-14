import test from 'node:test';
import assert from 'node:assert/strict';
import { PondSimulation, FLOAT_SECONDS, THROW_ORIGIN, flightPosition, inPond, type Food } from '../src/simulation.ts';
import { PelletMachine } from '../src/vending.ts';
import { DIRECTIONS, directionForHeading } from '../src/appearance.ts';
import { THROW_MOTIONS, LUCKY_BONUS_POINTS, handPose } from '../src/throws.ts';

test('all eight headings select a distinct view, wrap correctly, and stay stable at turn boundaries', () => {
  for (let i = 0; i < 8; i++) {
    assert.equal(directionForHeading(i * Math.PI / 4), DIRECTIONS[i]);
    assert.equal(directionForHeading(i * Math.PI / 4 - Math.PI * 4), DIRECTIONS[i]);
  }
  assert.equal(directionForHeading(Math.PI / 8 + 0.02, 'e'), 'e');
  assert.equal(directionForHeading(Math.PI / 8 + 0.12, 'e'), 'se');
  assert.equal(directionForHeading(-Math.PI / 8 - 0.12, 'e'), 'ne');
});

function advance(pond: PondSimulation, seconds: number): void {
  for (let i = 0; i < Math.ceil(seconds / 0.05); i++) pond.step(0.05);
}
function refill(pond: PondSimulation): void {
  assert.equal(pond.buyPellets(), true);
  advance(pond, 3.5);
}
function waterFood(x = 600, y = 389, age = 0): Food {
  return { id: 99, x, y, target: { x, y }, amount: 1, age, phase: 'water', flightTime: 1, flightDuration: 1, height: 0, releaseAt: 0, arcScale: 1, lucky: false, bonusClaimed: false };
}
function airFood(): Food {
  const food: Food = { ...THROW_ORIGIN, id: 1, target: { x: 600, y: 389 }, amount: 1, age: 0, phase: 'air', flightTime: 1.45, flightDuration: 3, height: 0, releaseAt: 0, arcScale: 1, lucky: false, bonusClaimed: false };
  Object.assign(food, flightPosition(food));
  return food;
}

test('one coin plays every vending stage and credits food only after collection, once', () => {
  const machine = new PelletMachine();
  assert.equal(machine.insertCoin(), true);
  assert.equal(machine.insertCoin(), false);
  assert.equal(machine.coinsUsed, 1);
  assert.equal(machine.moneyUsed, 5);
  const phases = new Set<string>();
  let granted = 0;
  for (let i = 0; i < 70; i++) {
    if (machine.busy) {
      phases.add(machine.phase);
      assert.equal(granted, 0, 'No throws may be available during the animation');
    }
    granted += machine.step(0.05);
  }
  assert.deepEqual([...phases], ['inserting', 'turning', 'dispensing', 'collecting']);
  assert.equal(granted, 20);
  assert.equal(machine.servings, 1);
  assert.equal(machine.step(100), 0);
});

test('a visit starts empty, and refills add twenty throws while preserving unused food and spending', () => {
  const pond = new PondSimulation(2);
  assert.equal(pond.handfuls, 0);
  assert.equal(pond.scatter({ x: 600, y: 389 }), false);
  assert.equal(pond.buyPellets(), true);
  assert.equal(pond.handfuls, 0);
  assert.equal(pond.buyPellets(), false);
  advance(pond, 3.5);
  assert.equal(pond.handfuls, 20);
  assert.equal(pond.scatter({ x: 600, y: 389 }), true);
  assert.equal(pond.handfuls, 19);
  refill(pond);
  assert.equal(pond.handfuls, 39);
  assert.equal(pond.machine.coinsUsed, 2);
  assert.equal(pond.machine.moneyUsed, 10);
});

test('throws share a fixed origin, follow an arc, and splash once at their intended water targets', () => {
  const pond = new PondSimulation(3);
  pond.animals = [];
  refill(pond);
  assert.equal(pond.scatter({ x: 10, y: 10 }), false);
  assert.equal(pond.handfuls, 20);
  pond.scatter({ x: 690, y: 320 });
  assert.equal(pond.handfuls, 19);
  assert.ok(pond.food.every(food => food.x === THROW_ORIGIN.x && food.y === THROW_ORIGIN.y && food.phase === 'air'));
  const pellet = pond.food[0];
  advance(pond, pellet.releaseAt - pond.elapsed + 0.35);
  const linearY = THROW_ORIGIN.y + (pellet.target.y - THROW_ORIGIN.y) * pellet.flightTime / pellet.flightDuration;
  assert.ok(pellet.y < linearY - 10);
  assert.equal(pond.splashes.length, 0);
  advance(pond, 2);
  assert.ok(pond.food.every(food => food.phase === 'water' && inPond(food)));
  assert.equal(pond.splashes.length, 4);
  pond.splashes.length = 0;
  advance(pond, 1);
  assert.equal(pond.splashes.length, 0);
});

test('fish ignore nearby airborne pellets and react when those pellets land', () => {
  const pond = new PondSimulation(4);
  const fish = pond.animals.find(animal => animal.profile.id === 'carp')!;
  const food = airFood();
  Object.assign(fish, flightPosition(food, food.flightTime + 0.05));
  fish.destination = { x: fish.x, y: fish.y };
  pond.animals = [fish]; pond.food = [food];
  pond.step(0.05);
  assert.equal(pond.fishFood, 0);
  assert.equal(fish.state, 'roaming');
  advance(pond, 2);
  assert.equal(food.phase, 'water');
  assert.ok(fish.state === 'approaching' || fish.state === 'chewing');
  advance(pond, 5);
  assert.ok(pond.fishFood > 0);
});

test('swimming birds notice high airborne food and paddle toward its landing point without eating it', () => {
  const pond = new PondSimulation(5);
  const gull = pond.animals.find(animal => animal.profile.id === 'gull')!;
  const food = airFood();
  gull.x = food.target.x - 80; gull.y = food.target.y; gull.heading = 0;
  pond.animals = [gull]; pond.food = [food];
  const before = gull.x;
  pond.step(0.05);
  assert.equal(gull.state, 'approaching');
  assert.ok(gull.x > before);
  assert.equal(pond.birdFood, 0);
  assert.equal(pond.splashes.length, 0);
});

test('a swimming gull catches a low airborne pellet before any water splash', () => {
  const pond = new PondSimulation(5);
  const gull = pond.animals.find(animal => animal.profile.id === 'gull')!;
  const food = airFood();
  food.flightTime = 2.9;
  Object.assign(gull, food.target);
  pond.animals = [gull]; pond.food = [food];
  pond.step(0.05);
  assert.equal(pond.birdFood, 1);
  assert.equal(pond.fishFood, 0);
  assert.equal(pond.food.length, 0);
  assert.equal(pond.bites[0].phase, 'air');
  assert.equal(pond.splashes.length, 0);
});

test('fish chew between bites, and score credits only the amount they actually eat', () => {
  const pond = new PondSimulation(6);
  const fish = pond.animals.find(animal => animal.profile.id === 'minnow')!;
  fish.x = 600; fish.y = 389; pond.animals = [fish]; pond.food = [waterFood()];
  pond.step(0.05);
  assert.equal(fish.state, 'chewing');
  assert.equal(pond.fishFood, 0.3);
  assert.equal(pond.score, 3);
  const amount = pond.food[0].amount;
  advance(pond, 0.5);
  assert.equal(pond.food[0].amount, amount);
  advance(pond, 3);
  assert.ok(Math.abs(pond.fishFood - 1) < 0.000001);
  assert.equal(pond.score, 10);
  assert.equal(pond.fedFish.size, 1);
});

test('birds can eat floating food but cannot eat it after it sinks', () => {
  const pond = new PondSimulation(7);
  const gull = pond.animals.find(animal => animal.profile.id === 'gull')!;
  gull.x = 600; gull.y = 389; pond.animals = [gull]; pond.food = [waterFood(600, 389, FLOAT_SECONDS + 0.1)];
  pond.step(0.05);
  assert.equal(pond.birdFood, 0);
  pond.food[0].age = 0;
  pond.step(0.05);
  assert.equal(pond.birdFood, 1);
});

test('pause freezes animals and airborne food, and long visits still allow feeding', () => {
  const pond = new PondSimulation(8);
  refill(pond);
  pond.scatter({ x: 600, y: 389 });
  pond.paused = true;
  const before = JSON.stringify({ food: pond.food, animals: pond.animals, crowd: pond.crowd, elapsed: pond.elapsed });
  advance(pond, 1);
  assert.equal(JSON.stringify({ food: pond.food, animals: pond.animals, crowd: pond.crowd, elapsed: pond.elapsed }), before);
  assert.equal(pond.scatter({ x: 600, y: 389 }), false);
  pond.paused = false;
  advance(pond, 180);
  assert.equal(pond.scatter({ x: 600, y: 389 }), true);
  assert.equal(pond.handfuls, 18);
});

test('koi glide, carp meander, and coots ease between paddle strokes and continuous drifts', () => {
  const pond = new PondSimulation(9);
  const koi = pond.animals.find(animal => animal.profile.id === 'koi')!;
  const carp = pond.animals.find(animal => animal.profile.id === 'carp')!;
  const coot = pond.animals.find(animal => animal.profile.id === 'coot')!;
  pond.animals = [koi, carp, coot];
  for (const animal of pond.animals) { animal.x = 600; animal.y = 389; animal.heading = 0; animal.phase = 0; animal.destination = { x: 900, y: 389 }; }
  let slowest = Infinity; let fastest = 0; let carpDeviation = 0;
  for (let i = 0; i < 160; i++) {
    const previous = { x: coot.x, y: coot.y };
    pond.step(0.05);
    const speed = Math.hypot(coot.x - previous.x, coot.y - previous.y) / 0.05;
    slowest = Math.min(slowest, speed); fastest = Math.max(fastest, speed);
    carpDeviation = Math.max(carpDeviation, Math.abs(carp.y - 389));
  }
  assert.ok(Math.abs(koi.y - 389) < 0.001);
  assert.ok(carpDeviation > 3);
  assert.ok(slowest > 0 && slowest < 4 && fastest > 12);
});

test('minnows stay in small moving shoals while gulls roam in broad sweeps', () => {
  const pond = new PondSimulation(10);
  const gull = pond.animals.find(animal => animal.profile.id === 'gull')!;
  let travelled = 0;
  let minX = gull.x; let maxX = gull.x; let minY = gull.y; let maxY = gull.y;
  for (let i = 0; i < 600; i++) {
    const before = { x: gull.x, y: gull.y };
    pond.step(0.05);
    travelled += Math.hypot(gull.x - before.x, gull.y - before.y);
    minX = Math.min(minX, gull.x); maxX = Math.max(maxX, gull.x);
    minY = Math.min(minY, gull.y); maxY = Math.max(maxY, gull.y);
  }
  // A swimming loop may finish close to where it started.
  assert.ok(travelled > 1000 && maxX - minX > 300 && maxY - minY > 100);
  for (const school of new Set(pond.animals.filter(a => a.school >= 0).map(a => a.school))) {
    const members = pond.animals.filter(a => a.school === school);
    const center = { x: members.reduce((s, a) => s + a.x, 0) / members.length, y: members.reduce((s, a) => s + a.y, 0) / members.length };
    assert.ok(members.every(a => Math.hypot(a.x - center.x, a.y - center.y) < 160));
  }
});

test('repeated refills conserve food and keep every swimming animal inside the pond', () => {
  const pond = new PondSimulation(11);
  for (let batch = 0; batch < 3; batch++) {
    refill(pond);
    for (let i = 0; i < 20; i++) pond.scatter(i % 2 ? { x: 1097, y: 389 } : { x: 600, y: 389 });
    advance(pond, 20);
  }
  assert.equal(pond.handfuls, 0);
  assert.equal(pond.machine.moneyUsed, 15);
  assert.ok(pond.fishFood > 0);
  assert.ok(pond.fishFood + pond.birdFood <= 240.000001);
  assert.ok(pond.animals.every(inPond));
  assert.ok(pond.fishShare >= 0 && pond.fishShare <= 1);
});

test('accepted throws follow the 60/30/10 mix and independently contain one lucky pellet about 2% of the time', () => {
  const pond = new PondSimulation(43210);
  pond.animals = []; pond.handfuls = 10_000;
  const counts = { toss: 0, overhand: 0, spread: 0 }; let lucky = 0;
  for (let i = 0; i < 10_000; i++) {
    assert.equal(pond.scatter({ x: 600, y: 389 }), true);
    const action = pond.lastThrow!;
    counts[action.animation]++;
    const goldenPellets = pond.food.filter(food => food.lucky).length;
    assert.equal(goldenPellets, action.lucky ? 1 : 0);
    if (action.lucky) lucky++;
    pond.food = [];
  }
  assert.ok(Math.abs(counts.toss / 10_000 - 0.6) < 0.015);
  assert.ok(Math.abs(counts.overhand / 10_000 - 0.3) < 0.015);
  assert.ok(Math.abs(counts.spread / 10_000 - 0.1) < 0.015);
  assert.ok(Math.abs(lucky / 10_000 - 0.02) < 0.004);
});

test('invalid input and refills preserve the lucky preview, while an accepted throw advances it', () => {
  let rolls = 0;
  const pond = new PondSimulation(22, () => { rolls++; return rolls % 2 ? 0.1 : 0.01; });
  assert.equal(pond.scatter({ x: 600, y: 389 }), false);
  assert.equal(rolls, 0);
  refill(pond);
  const preview = pond.nextThrow;
  assert.equal(preview?.lucky, true);
  assert.equal(rolls, 2);
  assert.equal(pond.scatter({ x: 10, y: 10 }), false);
  pond.paused = true;
  assert.equal(pond.scatter({ x: 600, y: 389 }), false);
  pond.paused = false;
  assert.equal(pond.buyPellets(), true);
  assert.equal(pond.scatter({ x: 600, y: 389 }), false);
  advance(pond, 3.5);
  assert.equal(pond.nextThrow, preview);
  assert.equal(rolls, 2);
  assert.equal(pond.scatter({ x: 600, y: 389 }), true);
  assert.equal(rolls, 4);
  assert.equal(pond.lastThrow?.lucky, true);
  assert.equal(pond.food.filter(food => food.lucky).length, 1);
});

test('rapid throws queue all three motions and launch food only when each hand reaches the fixed release point', () => {
  for (const animation of ['toss', 'overhand', 'spread'] as const) {
    const pose = handPose(animation, THROW_MOTIONS[animation].releaseDelay);
    assert.equal(pose.x, 0); assert.equal(pose.y, 0);
    assert.equal(pose.frame, `${animation}-release`);
  }
  const rolls = [0.1, 0.5, 0.75, 0.5, 0.95, 0.01]; let index = 0;
  const pond = new PondSimulation(23, () => rolls[index++ % rolls.length]);
  pond.animals = []; pond.handfuls = 3;
  for (let i = 0; i < 3; i++) pond.scatter({ x: 600, y: 389 });
  assert.equal(pond.pendingThrows, 3);
  assert.equal(pond.currentThrow?.animation, 'toss');
  const first = pond.food[0]; const second = pond.food[4]; const third = pond.food[8];
  assert.equal(first.releaseAt, THROW_MOTIONS.toss.releaseDelay);
  assert.equal(second.releaseAt, THROW_MOTIONS.toss.duration + THROW_MOTIONS.overhand.releaseDelay);
  advance(pond, first.releaseAt / 2);
  assert.ok(pond.food.every(food => food.x === THROW_ORIGIN.x && food.y === THROW_ORIGIN.y && food.flightTime === 0));
  advance(pond, first.releaseAt - pond.elapsed + 0.02);
  assert.ok(first.flightTime > 0);
  assert.equal(second.flightTime, 0); assert.equal(third.flightTime, 0);
  advance(pond, second.releaseAt - pond.elapsed + 0.02);
  assert.equal(pond.currentThrow?.animation, 'overhand');
  assert.ok(second.flightTime > 0); assert.equal(third.flightTime, 0);
  advance(pond, third.releaseAt - pond.elapsed + 0.02);
  assert.equal(pond.currentThrow?.animation, 'spread');
  assert.ok(third.flightTime > 0 && third.lucky);
  pond.paused = true;
  const frozen = JSON.stringify({ elapsed: pond.elapsed, current: pond.currentThrow, food: pond.food });
  advance(pond, 1);
  assert.equal(JSON.stringify({ elapsed: pond.elapsed, current: pond.currentThrow, food: pond.food }), frozen);
});

test('spread throws fan food across the aim point, stay inside the shoreline, and overhand food takes a higher arc', () => {
  const target = { x: THROW_ORIGIN.x, y: 389 };
  const throwFood = (roll: number, point = target) => {
    const pond = new PondSimulation(777, () => roll);
    pond.handfuls = 1; pond.animals = [];
    assert.equal(pond.scatter(point), true);
    return pond.food;
  };
  const tossed = throwFood(0.1); const overhand = throwFood(0.75); const spread = throwFood(0.95);
  const span = (food: Food[]) => Math.max(...food.map(pellet => pellet.target.x)) - Math.min(...food.map(pellet => pellet.target.x));
  assert.ok(span(spread) > 85);
  assert.ok(span(spread) > span(tossed) * 2);
  assert.ok(spread[0].target.x < target.x && spread[3].target.x > target.x);
  const height = (food: Food) => flightPosition(food, food.flightDuration / 2).height;
  assert.ok(height(overhand[0]) > height(tossed[0]) * 1.4);
  for (const point of [{ x: 600, y: 161 }, { x: 104, y: 389 }, { x: 1096, y: 389 }]) {
    assert.ok(throwFood(0.95, point).every(food => inPond(food.target)));
  }
});

test('a lucky pellet grants one fish-only bonus even when several fish share its small bites', () => {
  const pond = new PondSimulation(24);
  const fish = pond.animals.filter(animal => animal.profile.id === 'minnow').slice(0, 2);
  for (const animal of fish) { animal.x = 600; animal.y = 389; }
  const food = { ...waterFood(), lucky: true };
  pond.animals = fish; pond.food = [food];
  pond.step(0.05);
  assert.equal(pond.luckyBonus, LUCKY_BONUS_POINTS);
  assert.equal(pond.score, LUCKY_BONUS_POINTS + 6);
  assert.equal(food.bonusClaimed, true);
  assert.equal(pond.bites.filter(bite => bite.bonus > 0).length, 1);
  advance(pond, 3);
  assert.equal(pond.score, LUCKY_BONUS_POINTS + 10);
  assert.equal(pond.luckyBonus, LUCKY_BONUS_POINTS);
  assert.equal(pond.bites.filter(bite => bite.bonus > 0).length, 1);
});

test('a bird consuming the whole lucky pellet awards no bonus', () => {
  const pond = new PondSimulation(25);
  const bird = pond.animals.find(animal => animal.profile.id === 'gull')!;
  bird.x = 600; bird.y = 389;
  pond.animals = [bird]; pond.food = [{ ...waterFood(), lucky: true }];
  pond.step(0.05);
  assert.equal(pond.birdFood, 1); assert.equal(pond.food.length, 0);
  assert.equal(pond.score, 0); assert.equal(pond.luckyBonus, 0);
  assert.equal(pond.bites[0].bonus, 0);
});

test('a bird sharing a lucky pellet leaves its bonus for the first fish to nibble the remainder', () => {
  const pond = new PondSimulation(26);
  const bird = pond.animals.find(animal => animal.profile.id === 'coot')!;
  const fish = pond.animals.find(animal => animal.profile.id === 'minnow')!;
  bird.x = fish.x = 600; bird.y = fish.y = 389;
  pond.animals = [bird, fish]; pond.food = [{ ...waterFood(), lucky: true }];
  pond.step(0.05);
  assert.equal(pond.bites[0].kind, 'bird'); assert.equal(pond.bites[0].bonus, 0);
  assert.equal(pond.bites[1].kind, 'fish'); assert.equal(pond.bites[1].bonus, LUCKY_BONUS_POINTS);
  assert.equal(pond.luckyBonus, LUCKY_BONUS_POINTS);
  assert.equal(pond.birdFood, 0.45); assert.equal(pond.fishFood, 0.3);
});
