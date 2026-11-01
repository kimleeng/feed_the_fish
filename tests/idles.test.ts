import test from 'node:test';
import assert from 'node:assert/strict';
import { PondSimulation, inPond, type Food } from '../src/simulation.ts';
import { IDLE_DURATIONS, IDLE_HABITS, type IdleHabit } from '../src/idles.ts';
import { ObserverCrowd, WATCH_SPOTS } from '../src/observers.ts';
import { OBSERVER_SIGNATURES } from '../src/observer-idles.ts';

function advance(world: { step(dt: number): void }, seconds: number): void {
  for (let elapsed = 0; elapsed < seconds - 1e-8; elapsed += .05) world.step(Math.min(.05, seconds - elapsed));
}
function foodAt(x: number, y: number): Food {
  return { id: 1, throwId: 1, x, y, origin: { x,y }, target: { x,y }, amount: 1, age: 0,
    phase: 'water', launchHeight: 0, flightTime: 1, flightDuration: 1, height: 0,
    releaseAt: 0, arcScale: 1, lucky: false, bonusClaimed: false };
}

test('all 18 animal actions finish within 4.5 seconds and defer feeding until completion', () => {
  assert.equal(Object.keys(IDLE_DURATIONS).length, 18);
  for (const habit of Object.keys(IDLE_DURATIONS) as IdleHabit[]) {
    const world = new PondSimulation(201);
    const animal = world.animals.find(a => IDLE_HABITS[a.profile.id]?.includes(habit))!;
    world.animals = [animal]; animal.x = 600; animal.y = 389; animal.nextIdleAt = Infinity;
    const duration = IDLE_DURATIONS[habit][1];
    assert.ok(duration >= 1.5 && duration <= 4.5);
    animal.idle = { habit, duration, elapsed: 0, heading: animal.heading }; animal.state = 'idle';
    world.food = [foodAt(animal.x, animal.y)];
    advance(world, duration - .1);
    assert.equal(world.eatenFood, 0, habit);
    assert.equal(animal.state, 'idle', habit);
    world.food = []; advance(world, .2);
    assert.equal(animal.idle, null, habit);
    assert.ok(inPond(animal));
    world.food = [foodAt(animal.x, animal.y)]; world.step(.05);
    assert.ok(world.eatenFood > 0, `${habit} releases the animal to eat`);
  }
});

test('the scheduler interleaves sparse idles, keeps persistent habits and leaves the hidden turtle alone', () => {
  const world = new PondSimulation(202);
  const signatures = world.animals.map(a => [a.favoriteHabit, a.habitSide, a.habitTempo, a.habitIntensity]);
  const previous = new Set<number>(), seen = new Set<number>();
  let lastStart = -Infinity;
  for (let i = 0; i < 1800; i++) {
    world.step(.1);
    const active = world.animals.filter(a => a.idle);
    assert.ok(active.length <= 2);
    for (const animal of active) {
      assert.ok(animal.profile.kind !== 'turtle');
      assert.ok(animal.idle!.duration >= 1.5 && animal.idle!.duration <= 4.5);
      if (!previous.has(animal.id)) {
        assert.ok(world.elapsed - lastStart >= 2.999);
        lastStart = world.elapsed; seen.add(animal.id);
      }
    }
    previous.clear(); active.forEach(a => previous.add(a.id));
    assert.ok(world.animals.every(inPond));
  }
  assert.ok(seen.size >= 15);
  assert.deepEqual(world.animals.map(a => [a.favoriteHabit,a.habitSide,a.habitTempo,a.habitIntensity]), signatures);
  assert.deepEqual(new PondSimulation(202).animals.map(a => [a.favoriteHabit,a.habitSide,a.habitTempo,a.habitIntensity]), signatures);
});

test('due idles cannot interrupt a flight or meal, and boosts recover during an idle', () => {
  const flying = new PondSimulation(203);
  const bird = flying.animals.find(a => a.profile.kind === 'bird')!;
  flying.animals = [bird]; bird.nextIdleAt = 0;
  bird.flight = { origin: {x:400,y:389}, destination: {x:600,y:389}, elapsed:0, duration:12 };
  bird.state = 'taking-off';
  advance(flying, 8); assert.equal(bird.idle, null); assert.ok(bird.flight);
  const eating = new PondSimulation(204);
  const fish = eating.animals[0]; eating.animals = [fish]; fish.nextIdleAt = 0;
  fish.chewLeft = 15; fish.meal = { duration:15, amount:1 }; fish.state = 'chewing';
  advance(eating, 8); assert.equal(fish.idle, null); assert.equal(fish.state, 'chewing');
  fish.chewLeft = 0; fish.meal = null; fish.boostCharge = .2; fish.boosting = true;
  fish.idle = { habit:'fin-fan', elapsed:0, duration:3, heading:fish.heading }; fish.state = 'idle';
  advance(eating, 1);
  assert.equal(fish.boosting, false); assert.ok(fish.boostCharge > .2);
});

test('idle scheduling consumes no pellet-scatter or lucky-throw rolls', () => {
  const active = new PondSimulation(205), still = new PondSimulation(205);
  for (const world of [active, still]) {
    const animal = world.animals[0]; world.animals = [animal];
    animal.x = 400; animal.y = 389; animal.destination = {x:800,y:389};
    animal.nextIdleAt = world === active ? 0 : Infinity;
    world.elapsed = 6; world.step(.1); world.handfuls = 10;
    world.scatter({x:600,y:389});
  }
  assert.ok(active.animals[0].idle); assert.equal(still.animals[0].idle, null);
  assert.deepEqual(active.lastThrow, still.lastThrow);
  assert.deepEqual(active.nextThrow, still.nextThrow);
  assert.deepEqual(active.food.map(f => f.target), still.food.map(f => f.target));
});

test('a visitor finishes a short gesture before leaving and both clocks freeze with the pond', () => {
  const world = new PondSimulation(206);
  const person = world.crowd.people[0];
  Object.assign(person, { ...WATCH_SPOTS[0], state:'watching', stop:WATCH_SPOTS[0], watchRemaining:.1,
    idle:{ habit:OBSERVER_SIGNATURES[person.age][person.look], elapsed:0, duration:2.5 } });
  const animal = world.animals[0];
  animal.idle = {habit:'linger', elapsed:0, duration:3, heading:animal.heading}; animal.state = 'idle';
  advance(world,.5); assert.equal(person.state, 'watching');
  const before = JSON.stringify([person,animal]);
  world.paused = true; advance(world,3);
  assert.equal(JSON.stringify([person,animal]),before);
  world.paused = false; advance(world,2.1);
  assert.equal(person.idle,null); assert.equal(person.state,'leaving');
});

test('visitor gestures are spaced apart, never run while walking, and do not change original walk reviews', () => {
  const crowd = new ObserverCrowd(207);
  crowd.people.forEach((p,i) => Object.assign(p,{ ...WATCH_SPOTS[i], stop:WATCH_SPOTS[i], state:'watching',
    hasWatched:true, watchRemaining:180, nextIdleAt:0 }));
  let starts = 0, lastStart = -Infinity;
  const previous = new Set<number>();
  for (let i=0;i<1200;i++) {
    crowd.step(.1);
    const active = crowd.people.filter(p=>p.idle);
    assert.ok(active.length <= 1);
    for (const p of active) {
      assert.equal(p.state,'watching'); assert.equal(p.velocity,0);
      if (!previous.has(p.id)) { starts++; assert.ok(crowd.elapsed-lastStart>=7.999); lastStart=crowd.elapsed; }
    }
    previous.clear(); active.forEach(p=>previous.add(p.id));
  }
  assert.ok(starts>=4);
  crowd.startWalkReview(); advance(crowd,30);
  assert.ok(crowd.people.every(p=>p.state==='walking' && !p.idle));
});
