import test from 'node:test';
import assert from 'node:assert/strict';
import { PondSimulation, BIRD_FLIGHT_CHANCE, FLOAT_SECONDS, type Food } from '../src/simulation.ts';

function airFood(id = 1, throwId = 1, x = 500): Food {
  return { id, throwId, x: 600, y: 695, origin: { x: 600, y: 695 }, target: { x, y: 389 },
    launchHeight: 0, amount: 1, age: 0, phase: 'air', flightTime: 0, flightDuration: 4, height: 0,
    releaseAt: 0, arcScale: 1, lucky: false, bonusClaimed: false };
}
function pursuit(roll?: () => number, species = 'gull') {
  const pond = new PondSimulation(41, undefined, roll);
  pond.wind.sampleAt = time => ({ time, direction: 0, strength: 0, x: 0, y: 0 });
  const bird = pond.animals.find(animal => animal.profile.id === species)!;
  Object.assign(bird, { x: 300, y: 389, heading: 0 });
  pond.animals = [bird]; pond.food = [airFood()];
  return { pond, bird };
}

test('eligible takeoffs have a 50% threshold for every bird, with a paddle or ignore on a declined flight', () => {
  assert.equal(BIRD_FLIGHT_CHANCE, 0.5);
  for (const species of ['gull', 'duck', 'coot']) {
    for (const roll of [0, 0.499999, 0.5, 0.999999]) {
      const { pond, bird } = pursuit(() => roll, species);
      pond.step(0.05);
      assert.equal(!!bird.flight, roll < 0.5, `${species}, roll ${roll}`);
      assert.equal(bird.flightChoices[1], roll < 0.5);
      if (roll >= 0.5) assert.equal(bird.state, species === 'coot' ? 'roaming' : 'approaching');
    }
  }
});

test('one declined roll covers every pellet in a handful and every frame, then a new throw gets a fresh roll', () => {
  let rolls = 0;
  const { pond, bird } = pursuit(() => ++rolls === 1 ? 0.75 : 0.25);
  pond.food = [0, 1, 2, 3].map(id => airFood(id, 7, 500 + id * 4));
  for (let frame = 0; frame < 20; frame++) {
    bird.x = 300; bird.y = 389;
    // Successive sibling pellets become the closest, without another takeoff roll.
    if (frame > 0 && frame % 5 === 0) pond.food[0].amount = 0;
    pond.step(0.05);
    assert.equal(bird.flight, null);
    assert.equal(rolls, 1);
    assert.equal(bird.flightChoices[7], false);
  }
  pond.food = [airFood(10, 8)];
  pond.step(0.05);
  assert.equal(rolls, 2);
  assert.equal(bird.state, 'taking-off');
  assert.deepEqual(bird.flightChoices, { 8: true });
  pond.food = []; pond.step(0.05);
  assert.deepEqual(bird.flightChoices, {}, 'Expired choices cannot accumulate through a long visit.');
});

test('a throw rolls separately for each bird and never rolls before release, outside the band, or too late', () => {
  let rolls = 0;
  const pond = new PondSimulation(41, undefined, () => ++rolls % 2 ? 0.25 : 0.75);
  pond.wind.sampleAt = time => ({ time, direction: 0, strength: 0, x: 0, y: 0 });
  const birds = pond.animals.filter(animal => animal.profile.id === 'gull').slice(0, 2);
  birds.forEach((bird, index) => Object.assign(bird, { x: 300, y: 350 + index * 78, heading: 0 }));
  pond.animals = birds; pond.food = [{ ...airFood(), releaseAt: 1 }];
  pond.step(0.05); assert.equal(rolls, 0);
  pond.food[0].releaseAt = 0; pond.food[0].target.x = 1000;
  pond.step(0.05); assert.equal(rolls, 0);
  pond.food = [{ ...airFood(), x: 500, y: 389, phase: 'water', age: FLOAT_SECONDS - 0.2 }];
  pond.step(0.05); assert.equal(rolls, 0);
  pond.food = [airFood()]; pond.step(0.05);
  assert.equal(rolls, 2);
  assert.equal(!!birds[0].flight, true); assert.equal(!!birds[1].flight, false);
});

test('seeded takeoff choices stay near half over many throws without extra chances from four pellets', () => {
  const { pond, bird } = pursuit();
  let flights = 0;
  for (let throwId = 0; throwId < 2000; throwId++) {
    Object.assign(bird, { x: 300, y: 389, heading: 0, flight: null, altitude: 0 });
    pond.food = [0, 1, 2, 3].map(id => airFood(id, throwId, 500 + id));
    pond.step(0.05);
    if (bird.flight) flights++;
    assert.equal(Object.keys(bird.flightChoices).length, 1);
  }
  assert.ok(flights > 920 && flights < 1080, `${flights} flights in 2000 throws`);
});

test('takeoff decisions do not consume pellet scatter or lucky-throw randomness, and pellets keep their throw ID', () => {
  const flying = pursuit(() => 0).pond;
  const paddling = pursuit(() => 1).pond;
  flying.step(0.05); paddling.step(0.05);
  assert.ok(flying.animals[0].flight); assert.equal(paddling.animals[0].flight, null);
  for (const pond of [flying, paddling]) { pond.food = []; pond.handfuls = 20; }
  for (let i = 0; i < 20; i++) {
    for (const pond of [flying, paddling]) assert.equal(pond.scatter({ x: 600, y: 389 }), true);
    assert.deepEqual(flying.lastThrow, paddling.lastThrow);
    assert.deepEqual(flying.nextThrow, paddling.nextThrow);
    assert.deepEqual(flying.food.map(food => food.target), paddling.food.map(food => food.target));
    for (const pond of [flying, paddling]) {
      assert.equal(pond.food.length, 4);
      assert.ok(pond.food.every(food => food.throwId === pond.lastThrow!.id));
      pond.food = [];
    }
  }
});
