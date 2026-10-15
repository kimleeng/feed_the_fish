import test from 'node:test';
import assert from 'node:assert/strict';
import { ObserverCrowd, WATCH_SPOTS, type ObserverAge } from '../src/observers.ts';
import { PondSimulation, inPond } from '../src/simulation.ts';
import { THROW_MOTIONS } from '../src/throws.ts';
import { observerAtlas, observerFrame, observerHeight, walkingCycleDistance } from '../src/observer-art.ts';
import { OBSERVER_DESIGNS, OBSERVER_LOOKS } from '../src/observer-looks.ts';
import { WALK_FRAMES } from '../src/walking.ts';

function advance(simulation: { step(seconds: number): void }, seconds: number): void {
  for (let i = 0; i < Math.ceil(seconds / 0.05); i++) simulation.step(0.05);
}

function quietWatcher(crowd: ObserverCrowd) {
  const person = crowd.people.find(person => person.age === 'kid')!;
  Object.assign(person, { ...WATCH_SPOTS[0], stop: WATCH_SPOTS[0], state: 'watching', hasWatched: true,
    watchDuration: 80, watchRemaining: 80 });
  crowd.people = [person];
  return person;
}

test('larger visitors take longer steps and complete drawings follow distance traveled', () => {
  const crowd = new ObserverCrowd(12);
  const adult = crowd.people.find(person => person.age === 'adult')!;
  const kid = { ...adult, age: 'kid' as const };
  Object.assign(adult, { look: 0, scale: 1, y: 760, stride: 0, state: 'walking' });
  Object.assign(kid, { look: 0, scale: 1, y: 760, stride: 0, state: 'walking' });
  assert.ok(walkingCycleDistance(adult) > 50 && walkingCycleDistance(adult) < 180);
  assert.ok(walkingCycleDistance(kid) > 30 && walkingCycleDistance(kid) < 120);
  assert.ok(walkingCycleDistance(adult) > walkingCycleDistance(kid));
  const distance = walkingCycleDistance(adult);
  adult.scale = 1.1;
  assert.ok(Math.abs(walkingCycleDistance(adult) - distance * 1.1) < 0.000001);
  const frames = Array.from({ length: WALK_FRAMES }, (_, index) => observerFrame({ ...adult, stride: index * 4 / WALK_FRAMES }));
  assert.equal(new Set(frames).size, WALK_FRAMES);
  assert.equal(observerFrame({ ...adult, stride: 4 }), frames[0]);
  assert.equal(observerFrame({ ...kid, state: 'watching' }), 'observer-kid-0-watch');
});

test('footfall progress follows actual travel including approach depth, and stays still when stationary', () => {
  for (const direction of [-1, 1] as const) {
    const crowd = new ObserverCrowd(12);
    const person = crowd.people[0];
    Object.assign(person, { x: 600 - direction * 35, y: 762, lane: 773, direction, speed: 40, velocity: 40, stride: 0,
      state: 'approaching', stop: { x: 600, y: 738 }, stopRoll: 0, watchRemaining: 30 });
    crowd.people = [person];
    let distance = 0;
    for (let step = 0; step < 20 && person.state !== 'watching'; step++) {
      const before = { x: person.x, y: person.y };
      crowd.step(0.1);
      const travel = Math.hypot(person.x - before.x, person.y - before.y);
      distance += travel;
    }
    assert.ok(distance > 35, 'Walking toward the rail includes travel up the path');
    assert.ok(person.stride > 35 * 4 / walkingCycleDistance(person), 'The diagonal route includes steps toward the rail');
    assert.equal(person.state, 'watching');
    const stopped = person.stride;
    crowd.step(0.1); crowd.step(0);
    assert.equal(person.stride, stopped);
  }
});

test('visitors brake before watching, plant their feet, and build up speed again when leaving', () => {
  for (const age of ['adult', 'kid'] as const) for (const direction of [-1, 1] as const) {
    const crowd = new ObserverCrowd(12);
    const person = crowd.people[0];
    Object.assign(person, { age, direction, x: 600 - direction * 60, y: 760, lane: 773,
      speed: 40, velocity: 40, state: 'approaching', stop: { x: 600, y: 738 },
      stopRoll: 0, watchRemaining: 30 });
    crowd.people = [person];
    let brakingSteps = 0;
    for (let step = 0; step < 180 && person.state !== 'watching'; step++) {
      const before = person.x;
      crowd.step(1 / 60);
      assert.ok((person.x - before) * direction >= -1e-8, 'Never step backward while braking');
      assert.ok((600 - person.x) * direction >= -1e-8, 'Never overshoot the watching spot');
      if (person.velocity > 0 && person.velocity < 30) brakingSteps++;
    }
    assert.ok(brakingSteps > 5, 'Slows visibly instead of snapping to a stop');
    assert.equal(person.state, 'watching');
    assert.equal(person.velocity, 0);
    assert.equal(person.x, 600); assert.equal(person.y, 738);
    const stride = person.stride;
    advance(crowd, 1);
    assert.equal(person.stride, stride);
    person.watchRemaining = 0;
    crowd.step(0.05);
    assert.equal(person.state, 'leaving');
    crowd.step(0.05);
    assert.ok(Math.abs(person.x - 600) < 0.2, 'The first departing step eases out of rest');
    assert.ok(person.velocity > 0 && person.velocity < person.speed);
    advance(crowd, 1);
    assert.equal(person.velocity, person.speed);
  }
});

test('interest fades after each observer’s five-to-ten-second threshold and throwing resets that quiet period', () => {
  const crowd = new ObserverCrowd(12);
  const watcher = quietWatcher(crowd);
  assert.ok(watcher.quietAfter >= 5 && watcher.quietAfter <= 10);
  advance(crowd, 4.9);
  assert.equal(watcher.interest, 1);
  advance(crowd, 5.2);
  assert.ok(watcher.interest < 1);
  const quiet = watcher.interest;
  crowd.noticeThrow();
  assert.ok(watcher.interest > quiet);
  const afterThrow = watcher.interest;
  advance(crowd, 4.9);
  assert.equal(watcher.interest, afterThrow);
  advance(crowd, 5.2);
  assert.ok(watcher.interest < afterThrow);
  const beforeNibble = watcher.interest;
  crowd.noticeEating(0.3);
  assert.ok(watcher.interest > beforeNibble);
  const afterNibble = watcher.interest;
  advance(crowd, 1);
  assert.ok(watcher.interest < afterNibble, 'Eating does not reset the time since a throw');
});

test('feeding modestly prolongs a watch, stays bounded, and can tempt a passing visitor to stop', () => {
  const active = new ObserverCrowd(12), quiet = new ObserverCrowd(12);
  const interested = quietWatcher(active), idle = quietWatcher(quiet);
  active.noticeThrow(); active.noticeEating(1);
  advance(active, 4); advance(quiet, 4);
  assert.ok(interested.watchRemaining > idle.watchRemaining);
  assert.ok(interested.watchRemaining - idle.watchRemaining < 1, 'One throw gives only a modest extension');
  for (let i = 0; i < 100; i++) { active.noticeThrow(); active.noticeEating(4); }
  assert.ok(interested.interest <= 1.15);
  advance(active, 30);
  assert.ok(interested.interest >= 0.8);
  assert.ok(interested.watchRemaining < 55, 'Even a highly interested observer eventually moves on');

  const passing = new ObserverCrowd(4);
  const visitor = passing.people[0];
  Object.assign(visitor, { age: 'adult', x: 50, state: 'walking', stop: null, hasWatched: false,
    interest: 1, stopRoll: 0.705 });
  passing.people = [visitor];
  passing.noticeThrow();
  assert.equal(visitor.state, 'approaching');
  assert.ok(visitor.stop);
});

test('observers respond once per actual release, and queued input, refills, and pause do not boost interest', () => {
  const pond = new PondSimulation(1, () => 0.5);
  pond.animals = [];
  pond.buyPellets(); advance(pond, 3.5);
  const person = pond.crowd.people.find(person => person.age === 'adult')!;
  const before = person.interest;
  assert.equal(pond.scatter({ x: 20, y: 20 }), false);
  assert.equal(pond.scatter({ x: 600, y: 389 }), true);
  assert.equal(pond.scatter({ x: 600, y: 389 }), true);
  assert.equal(person.interest, before);
  advance(pond, THROW_MOTIONS.toss.releaseDelay - 0.05);
  assert.equal(person.interest, before, 'Windup is not a visible throw');
  advance(pond, 0.1);
  assert.ok(Math.abs(person.interest - before - 0.04) < 0.000001);
  advance(pond, 0.1);
  assert.ok(Math.abs(person.interest - before - 0.04) < 0.000001, 'A release counts only once');
  advance(pond, THROW_MOTIONS.toss.duration);
  assert.ok(Math.abs(person.interest - before - 0.08) < 0.000001, 'The second queued throw boosts on its own release');
  pond.paused = true;
  const frozen = JSON.stringify(pond.crowd);
  advance(pond, 2);
  assert.equal(JSON.stringify(pond.crowd), frozen);
});

test('both fish and bird bites raise interest by the amount actually eaten', () => {
  for (const species of ['minnow', 'gull']) {
    const pond = new PondSimulation(8);
    const animal = pond.animals.find(animal => animal.profile.id === species)!;
    animal.x = 600; animal.y = 389;
    pond.animals = [animal];
    pond.food = [{ id: 1, throwId: 1, x: 600, y: 389, origin: { x: 600, y: 389 }, launchHeight: 0,
      target: { x: 600, y: 389 }, amount: 1, age: 0,
      phase: 'water', flightTime: 1, flightDuration: 1, height: 0, releaseAt: 0, arcScale: 1, lucky: false, bonusClaimed: false }];
    const observer = pond.crowd.people[0];
    pond.step(0.05);
    assert.ok(Math.abs(observer.interest - 1 - animal.profile.bite * 0.01) < 0.000001);
  }
});

test('a visit opens with two to four visitors, including an adult and a kid', () => {
  for (let seed = 0; seed < 50; seed++) {
    const crowd = new ObserverCrowd(seed);
    assert.ok(crowd.people.length >= 2 && crowd.people.length <= 4);
    assert.ok(crowd.people.some(person => person.age === 'adult'));
    assert.ok(crowd.people.some(person => person.age === 'kid'));
    assert.deepEqual(crowd.people, new ObserverCrowd(seed).people);
  }
});

test('all visitor looks can arrive, keep their outfit through a visit, and avoid duplicates while another look is free', () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < 6; seed++) {
    const crowd = new ObserverCrowd(seed);
    const outfits = new Map<number, string>();
    for (let tick = 0; tick < 6000; tick++) {
      for (const person of crowd.people) {
        const design = `observer-${person.age}-${person.look}`;
        assert.ok(OBSERVER_DESIGNS.some(look => look.design === design));
        assert.ok(Number.isFinite(observerHeight(person)) && walkingCycleDistance(person) > 0);
        if (outfits.has(person.id)) assert.equal(design, outfits.get(person.id), 'Walking and watching retain the same outfit');
        else {
          const peers = crowd.people.filter(other => other.age === person.age && other.id < person.id);
          if (new Set(peers.map(peer => peer.look)).size < OBSERVER_LOOKS[person.age].length) {
            assert.ok(peers.every(peer => peer.look !== person.look), 'Choose an unused outfit when one is available');
          }
          outfits.set(person.id, design); seen.add(design);
        }
        const expectedAtlas = person.state === 'watching' && !OBSERVER_LOOKS[person.age][person.look].watchingInSheet
          ? 'garden-observers' : 'people-walking';
        assert.equal(observerAtlas(person), expectedAtlas);
      }
      crowd.step(.1);
    }
  }
  assert.deepEqual([...seen].sort(), OBSERVER_DESIGNS.map(look => look.design).sort());
});

test('visitors cross dry paving, stop at distinct places, watch, and leave the garden', () => {
  const crowd = new ObserverCrowd(7);
  const originalIds = crowd.people.map(person => person.id);
  const directions = new Set<number>();
  const states = new Set<string>();
  let stillWatching = 0;
  for (let tick = 0; tick < 4000; tick++) {
    const before = new Map(crowd.people.map(person => [person.id, { ...person }]));
    crowd.step(0.1);
    const occupied = crowd.people.filter(person => person.stop).map(person => person.stop);
    assert.equal(new Set(occupied).size, occupied.length, 'Watching places must not overlap');
    for (const person of crowd.people) {
      assert.equal(inPond(person), false, 'Feet stay on the garden path');
      directions.add(person.direction); states.add(person.state);
      if (person.state === 'watching') {
        assert.ok(WATCH_SPOTS.includes(person.stop!));
        assert.equal(person.x, person.stop!.x); assert.equal(person.y, person.stop!.y);
        const previous = before.get(person.id);
        if (previous?.state === 'watching') {
          assert.equal(person.x, previous.x); assert.equal(person.y, previous.y);
          assert.ok(person.watchRemaining < previous.watchRemaining);
          assert.equal(person.stride, previous.stride, 'Stopped visitors do not keep walking');
          stillWatching++;
        }
      }
    }
  }
  assert.deepEqual([...directions].sort(), [-1, 1]);
  assert.deepEqual([...states].sort(), ['approaching', 'leaving', 'walking', 'watching']);
  assert.ok(stillWatching > 100);
  assert.ok(originalIds.every(id => !crowd.people.some(person => person.id === id)));
});

test('long visits average two to four people, seldom exceed eight, and kids stay longer more often', () => {
  let population = 0, samples = 0, crowded = 0, typical = 0, smallest = Infinity, largest = 0;
  const interest: Record<ObserverAge, { total: number; stops: number; long: number; duration: number }> = {
    adult: { total: 0, stops: 0, long: 0, duration: 0 },
    kid: { total: 0, stops: 0, long: 0, duration: 0 },
  };
  for (let seed = 0; seed < 12; seed++) {
    const crowd = new ObserverCrowd(seed);
    const seen = new Set<number>();
    for (let tick = 0; tick < 18000; tick++) {
      crowd.step(0.1);
      for (const person of crowd.people) {
        if (seen.has(person.id)) continue;
        seen.add(person.id);
        const age = interest[person.age];
        age.total++;
        if (person.watchDuration > 0) {
          age.stops++; age.duration += person.watchDuration;
          if (person.watchDuration >= 25) age.long++;
          else assert.ok(person.watchDuration <= 15);
        }
      }
      if (tick < 600) continue;
      const count = crowd.people.filter(person => person.x > -20 && person.x < 1220).length;
      population += count; samples++;
      smallest = Math.min(smallest, count); largest = Math.max(largest, count);
      if (count > 8) crowded++;
      if (count >= 2 && count <= 4) typical++;
      assert.ok(crowd.people.length <= 10);
    }
  }
  assert.ok(population / samples >= 2 && population / samples <= 4);
  assert.ok(typical / samples > 0.6);
  assert.ok(crowded / samples < 0.01);
  assert.ok(largest - smallest >= 4, 'Foot traffic should vary during a visit');
  assert.ok(interest.adult.total > 500 && interest.kid.total > 300);
  assert.ok(interest.adult.stops / interest.adult.total > 0.6);
  assert.ok(interest.kid.stops / interest.kid.total > 0.8);
  assert.ok(interest.adult.long / interest.adult.stops < 0.25);
  assert.ok(interest.kid.long / interest.kid.stops > 0.4);
  assert.ok(interest.kid.duration / interest.kid.stops > interest.adult.duration / interest.adult.stops * 2);
});
