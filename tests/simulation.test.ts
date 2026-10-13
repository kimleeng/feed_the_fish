import test from 'node:test';
import assert from 'node:assert/strict';
import { PondSimulation, FLOAT_SECONDS, THROW_ORIGIN, flightPosition, inPond, type Food } from '../src/simulation.ts';
import { PelletMachine } from '../src/vending.ts';

function advance(pond: PondSimulation, seconds: number): void {
  for (let i = 0; i < Math.ceil(seconds / 0.05); i++) pond.step(0.05);
}
function refill(pond: PondSimulation): void {
  assert.equal(pond.buyPellets(), true);
  advance(pond, 3.5);
}
function waterFood(x = 600, y = 389, age = 0): Food {
  return { id: 99, x, y, target: { x, y }, amount: 1, age, phase: 'water', flightTime: 1, flightDuration: 1, height: 0 };
}
function airFood(): Food {
  const food: Food = { ...THROW_ORIGIN, id: 1, target: { x: 600, y: 389 }, amount: 1, age: 0, phase: 'air', flightTime: 1.45, flightDuration: 3, height: 0 };
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
  advance(pond, 0.35);
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

test('a gull notices and catches an airborne pellet before any water splash', () => {
  const pond = new PondSimulation(5);
  const gull = pond.animals.find(animal => animal.profile.id === 'gull')!;
  const food = airFood();
  Object.assign(gull, flightPosition(food, food.flightTime + 0.05));
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
  const before = JSON.stringify({ food: pond.food, animals: pond.animals, elapsed: pond.elapsed });
  advance(pond, 1);
  assert.equal(JSON.stringify({ food: pond.food, animals: pond.animals, elapsed: pond.elapsed }), before);
  assert.equal(pond.scatter({ x: 600, y: 389 }), false);
  pond.paused = false;
  advance(pond, 180);
  assert.equal(pond.scatter({ x: 600, y: 389 }), true);
  assert.equal(pond.handfuls, 18);
});

test('koi glide, carp meander, and doves alternate hops with resting', () => {
  const pond = new PondSimulation(9);
  const koi = pond.animals.find(animal => animal.profile.id === 'koi')!;
  const carp = pond.animals.find(animal => animal.profile.id === 'carp')!;
  const dove = pond.animals.find(animal => animal.profile.id === 'dove')!;
  pond.animals = [koi, carp, dove];
  for (const animal of pond.animals) { animal.x = 600; animal.y = 389; animal.heading = 0; animal.phase = 0; animal.destination = { x: 900, y: 389 }; }
  let rests = 0; let hops = 0; let carpDeviation = 0;
  for (let i = 0; i < 160; i++) {
    const previous = { x: dove.x, y: dove.y };
    pond.step(0.05);
    if (Math.hypot(dove.x - previous.x, dove.y - previous.y) < 0.001) rests++;
    else hops++;
    carpDeviation = Math.max(carpDeviation, Math.abs(carp.y - 389));
  }
  assert.ok(Math.abs(koi.y - 389) < 0.001);
  assert.ok(carpDeviation > 3);
  assert.ok(rests > 5 && hops > 5);
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
  // A circular flight may finish close to where it started.
  assert.ok(travelled > 1000 && maxX - minX > 300 && maxY - minY > 100);
  for (const school of new Set(pond.animals.filter(a => a.school >= 0).map(a => a.school))) {
    const members = pond.animals.filter(a => a.school === school);
    const center = { x: members.reduce((s, a) => s + a.x, 0) / members.length, y: members.reduce((s, a) => s + a.y, 0) / members.length };
    assert.ok(members.every(a => Math.hypot(a.x - center.x, a.y - center.y) < 160));
  }
});

test('repeated refills conserve food and keep fish and ducks inside the pond', () => {
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
  assert.ok(pond.animals.filter(a => a.profile.kind === 'fish' || a.profile.movement === 'paddle').every(inPond));
  assert.ok(pond.fishShare >= 0 && pond.fishShare <= 1);
});
