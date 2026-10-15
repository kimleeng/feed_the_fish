import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PondSimulation, POND, animalCollisionRadius, shareCollisionLayer, inPond, type Animal } from '../src/simulation.ts';
import { animalAtlas } from '../src/appearance.ts';

function gap(first: Animal, second: Animal): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function restingPair(kind: 'fish' | 'bird'): PondSimulation {
  const pond = new PondSimulation(42);
  pond.animals = pond.animals.filter(animal => animal.profile.kind === kind).slice(0, 2);
  for (const animal of pond.animals) Object.assign(animal, { x: 600, y: 389, chewLeft: 30, state: 'chewing' });
  return pond;
}

test('collision cores are smaller than every actual swimming-art cut', () => {
  const pond = new PondSimulation(1);
  for (const kind of ['fish', 'bird', 'turtle'] as const) {
    const atlas = JSON.parse(readFileSync(new URL(`../public/art/${animalAtlas(kind)}-animation.json`, import.meta.url), 'utf8'));
    for (const animal of pond.animals.filter(animal => animal.profile.kind === kind)) {
      for (const entry of atlas.textures.flatMap((texture: { frames: object[] }) => texture.frames) as
        { filename: string; frame: { w: number; h: number }; referenceHeight: number }[]) {
        const name = entry.filename;
        if (!name.startsWith(animal.profile.texture + '-') || name.endsWith('-head')) continue;
        const width = entry.frame.w / entry.referenceHeight * animal.profile.size;
        const height = entry.frame.h / entry.referenceHeight * animal.profile.size;
        assert.ok(animalCollisionRadius(animal) * 2 < Math.min(width, height), `${name} has room outside its collision core`);
      }
    }
  }
});

test('stacked fish and birds separate their small body cores without bouncing or turning while chewing', () => {
  for (const kind of ['fish', 'bird'] as const) {
    const pond = restingPair(kind);
    const [first, second] = pond.animals;
    const headings = pond.animals.map(animal => animal.heading);
    pond.step(0.05);
    assert.ok(gap(first, second) >= animalCollisionRadius(first) + animalCollisionRadius(second) - 0.001);
    assert.ok(gap(first, second) < first.profile.size / 2, 'The art can still overlap around the smaller bodies');
    assert.deepEqual(pond.animals.map(animal => animal.heading), headings);
    const positions = pond.animals.map(animal => ({ x: animal.x, y: animal.y }));
    pond.step(0.05);
    assert.deepEqual(pond.animals.map(animal => ({ x: animal.x, y: animal.y })), positions);
  }
});

test('submerged fish can remain beneath a floating bird', () => {
  const pond = new PondSimulation(2);
  pond.animals = [pond.animals.find(animal => animal.profile.kind === 'fish')!,
    pond.animals.find(animal => animal.profile.kind === 'bird')!];
  for (const animal of pond.animals) Object.assign(animal, { x: 600, y: 389, chewLeft: 30, state: 'chewing' });
  pond.step(0.05);
  assert.ok(pond.animals.every(animal => animal.x === 600 && animal.y === 389));
});

test('flying birds pass above swimmers and regain collision space when they land', () => {
  const pond = restingPair('bird');
  const [flying, swimming] = pond.animals;
  flying.chewLeft = 0;
  flying.flight = { origin: { x: 580, y: 389 }, destination: { x: 620, y: 389 }, elapsed: 0.55, duration: 1.2 };
  pond.step(0.05);
  assert.ok(flying.altitude > 0);
  assert.equal(shareCollisionLayer(flying, swimming), false);
  assert.ok(gap(flying, swimming) < 0.001, 'A bird in the air must not push a swimmer aside.');
  swimming.x = 620;
  for (let tick = 0; flying.flight && tick < 30; tick++) pond.step(0.05);
  assert.equal(flying.flight, null);
  assert.equal(flying.altitude, 0);
  assert.equal(shareCollisionLayer(flying, swimming), true);
  assert.ok(gap(flying, swimming) >= animalCollisionRadius(flying) + animalCollisionRadius(swimming) - 0.01);
});

test('animals meeting head-on steer past one another and keep their bodies apart', () => {
  const pond = restingPair('fish');
  const [first, second] = pond.animals;
  Object.assign(first, { x: 580, chewLeft: 0, heading: 0, phase: 0, destination: { x: 820, y: 389 } });
  Object.assign(second, { x: 620, chewLeft: 0, heading: Math.PI, phase: 0, destination: { x: 380, y: 389 } });
  for (let tick = 0; tick < 200; tick++) {
    pond.step(0.05);
    assert.ok(gap(first, second) >= animalCollisionRadius(first) + animalCollisionRadius(second) - 0.01);
  }
  assert.ok(first.x > second.x, 'The animals pass instead of remaining blocked face to face');
});

test('collision handling freezes with pause and zero time, and keeps entire bodies inside the shoreline', () => {
  for (const angle of [0, Math.PI / 2, 1.1]) {
    const pond = restingPair('bird');
    for (const animal of pond.animals) Object.assign(animal, {
      x: POND.x + Math.cos(angle) * POND.rx * 0.999,
      y: POND.y + Math.sin(angle) * POND.ry * 0.999,
    });
    const frozen = JSON.stringify(pond.animals);
    pond.step(0);
    assert.equal(JSON.stringify(pond.animals), frozen);
    pond.paused = true; pond.step(0.1);
    assert.equal(JSON.stringify(pond.animals), frozen);
    pond.paused = false;
    for (let tick = 0; tick < 20; tick++) pond.step(0.05);
    const [first, second] = pond.animals;
    assert.ok(gap(first, second) >= animalCollisionRadius(first) + animalCollisionRadius(second) - 0.01);
    for (const animal of pond.animals) for (let sample = 0; sample < 16; sample++) {
      const radius = animalCollisionRadius(animal), direction = sample * Math.PI / 8;
      assert.ok(inPond({ x: animal.x + Math.cos(direction) * radius, y: animal.y + Math.sin(direction) * radius }));
    }
  }
});

test('a crowded feeding shoal can reach pellets without piling up or changing the food budget', () => {
  const pond = new PondSimulation(12, () => 0.5);
  pond.animals = pond.animals.filter(animal => animal.profile.id === 'minnow').slice(0, 8);
  for (const [index, animal] of pond.animals.entries()) {
    const angle = index * Math.PI / 4;
    Object.assign(animal, { x: 600 + Math.cos(angle) * 20, y: 389 + Math.sin(angle) * 20,
      heading: angle + Math.PI, destination: { x: 600, y: 389 }, chewLeft: 0 });
  }
  pond.handfuls = 2;
  assert.equal(pond.scatter({ x: 600, y: 389 }), true);
  assert.equal(pond.scatter({ x: 600, y: 389 }), true);
  for (let tick = 0; tick < 180; tick++) {
    pond.step(0.05);
    for (let i = 0; i < pond.animals.length; i++) for (let j = i + 1; j < pond.animals.length; j++) {
      const first = pond.animals[i], second = pond.animals[j];
      assert.ok(gap(first, second) >= animalCollisionRadius(first) + animalCollisionRadius(second) - 0.3);
    }
  }
  assert.ok(pond.fishFood > 4, 'Most of the food remains reachable');
  assert.ok(pond.fedFish.size >= 4, 'Several fish can take turns at the feeding spot');
  assert.ok(Math.abs(pond.fishFood + pond.food.reduce((sum, food) => sum + food.amount, 0) - 8) < 0.000001);
});

test('the full pond keeps body space when all ten throws land in one patch', () => {
  const pond = new PondSimulation(21, () => 0.5);
  pond.buyPellets();
  for (let tick = 0; tick < 70; tick++) pond.step(0.05);
  for (let throwIndex = 0; throwIndex < 10; throwIndex++) pond.scatter({ x: 600, y: 389 });
  for (let tick = 0; tick < 200; tick++) {
    pond.step(0.05);
    for (let i = 0; i < pond.animals.length; i++) for (let j = i + 1; j < pond.animals.length; j++) {
      const first = pond.animals[i], second = pond.animals[j];
      if (!shareCollisionLayer(first, second)) continue;
      assert.ok(gap(first, second) >= animalCollisionRadius(first) + animalCollisionRadius(second) - 0.3);
    }
  }
  assert.ok(pond.fedFish.size >= 10);
  assert.ok(Math.abs(pond.eatenFood + pond.food.reduce((sum, food) => sum + food.amount, 0) - 40) < 0.000001);
});
