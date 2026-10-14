import test from 'node:test';
import assert from 'node:assert/strict';
import { ObserverCrowd, WATCH_SPOTS, type ObserverAge } from '../src/observers.ts';
import { inPond } from '../src/simulation.ts';

test('a visit opens with two to four visitors, including an adult and a kid', () => {
  for (let seed = 0; seed < 50; seed++) {
    const crowd = new ObserverCrowd(seed);
    assert.ok(crowd.people.length >= 2 && crowd.people.length <= 4);
    assert.ok(crowd.people.some(person => person.age === 'adult'));
    assert.ok(crowd.people.some(person => person.age === 'kid'));
    assert.deepEqual(crowd.people, new ObserverCrowd(seed).people);
  }
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
