import { walkingCycleDistance } from './observer-art.ts';
import { pathBlend, walkingAdvance } from './walking.ts';
import { OBSERVER_LOOKS } from './observer-looks.ts';

export type ObserverAge = 'adult' | 'kid';
export type ObserverState = 'walking' | 'approaching' | 'watching' | 'leaving';
interface Point { x: number; y: number }

export interface Observer extends Point {
  id: number;
  age: ObserverAge;
  state: ObserverState;
  direction: -1 | 1;
  speed: number;
  velocity: number;
  lane: number;
  look: number;
  scale: number;
  stride: number;
  stop: Point | null;
  watchDuration: number;
  watchRemaining: number;
  interest: number;
  quietAfter: number;
  stopRoll: number;
  hasWatched: boolean;
  walkReview?: boolean;
}

export const OBSERVER_PATH = { start: -50, end: 1250, lanes: [760, 773, 784] };
// Dry paving in front of the railing, leaving the machine and dock character clear.
export const WATCH_SPOTS: readonly Point[] = [
  { x: 270, y: 738 }, { x: 335, y: 735 }, { x: 490, y: 740 },
  { x: 725, y: 738 }, { x: 800, y: 735 }, { x: 870, y: 738 }, { x: 935, y: 744 },
];
export const OBSERVER_INTEREST = {
  adult: { stopChance: 0.7, longWatchChance: 0.16, short: [4, 11], long: [25, 60] },
  kid: { stopChance: 0.9, longWatchChance: 0.52, short: [6, 15], long: [40, 90] },
} as const;

function pathY(x: number, lane: number): number {
  return lane - Math.sin(Math.max(0, Math.min(1200, x)) / 1200 * Math.PI) * 7;
}

export class ObserverCrowd {
  people: Observer[] = [];
  elapsed = 0;
  private random: () => number;
  private nextId = 0;
  private arrivalIn = 0;
  private lastThrowAt = 0;
  private sceneInterest = 1;
  private reviewingWalks = false;

  constructor(seed = Date.now()) {
    let value = seed >>> 0;
    this.random = () => {
      value += 0x6d2b79f5;
      let t = Math.imul(value ^ value >>> 15, 1 | value);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    const count = 2 + Math.floor(this.random() * 3);
    for (let i = 0; i < count; i++) {
      const progress = (i + 0.5) / count + (this.random() - 0.5) * 0.1;
      this.arrive(progress, i === 0 ? 'adult' : i === 1 ? 'kid' : undefined);
    }
    this.arrivalIn = this.nextArrival();
  }

  startWalkReview(): void {
    this.reviewingWalks = true;
    // Start inside both the desktop view and the phone's narrower crop.
    // Matching ages keep the same size and speed on the two separate lanes.
    this.people = ([
      { age: 'adult', direction: 1, x: 300, lane: 750 },
      { age: 'kid', direction: 1, x: 500, lane: 750 },
      { age: 'kid', direction: -1, x: 700, lane: 784 },
      { age: 'adult', direction: -1, x: 900, lane: 784 },
    ] as const).map(model => {
      const speed = model.age === 'adult' ? 38 : 44;
      const person: Observer = { ...model, id: this.nextId++, y: pathY(model.x, model.lane), look: 0, scale: 1,
        state: 'walking', speed, velocity: speed, stride: 0, stop: null,
        watchDuration: 0, watchRemaining: 0, interest: 1, quietAfter: Infinity,
        stopRoll: 1, hasWatched: true, walkReview: true };
      return person;
    });
  }

  private between(min: number, max: number): number { return min + this.random() * (max - min); }

  private nextArrival(): number {
    // Uneven foot traffic lets the population fluctuate naturally.
    return 2.5 - Math.log(1 - this.random()) * 13;
  }

  private stopChance(person: Observer): number {
    return OBSERVER_INTEREST[person.age].stopChance + (person.interest - 1) * 0.3;
  }

  private inviteToWatch(person: Observer): void {
    if (person.state !== 'walking' || person.hasWatched || person.stopRoll >= this.stopChance(person)) return;
    const available = WATCH_SPOTS.filter(spot => (spot.x - person.x) * person.direction > 50 &&
      !this.people.some(other => other.stop === spot));
    if (!available.length) return;
    const interest = OBSERVER_INTEREST[person.age];
    const longChance = interest.longWatchChance + (person.interest - 1) * 0.3;
    const range = this.random() < longChance ? interest.long : interest.short;
    person.stop = available[Math.floor(this.random() * available.length)];
    person.state = 'approaching';
    person.watchDuration = this.between(range[0], range[1]);
    person.watchRemaining = person.watchDuration;
  }

  private noticeFeeding(boost: number): void {
    this.sceneInterest = Math.min(1.15, this.sceneInterest + boost);
    for (const person of this.people) {
      person.interest = Math.min(1.15, person.interest + boost);
      this.inviteToWatch(person);
    }
  }

  noticeThrow(): void {
    this.lastThrowAt = this.elapsed;
    this.noticeFeeding(0.04);
  }

  noticeEating(amount: number): void {
    // Nibbles scale with the food eaten, so splitting a pellet does not multiply interest.
    this.noticeFeeding(Math.max(0, amount) * 0.01);
  }

  private arrive(progress = 0, age: ObserverAge = this.random() < 0.35 ? 'kid' : 'adult'): void {
    const direction = this.random() < 0.5 ? 1 : -1;
    const x = direction === 1
      ? OBSERVER_PATH.start + (OBSERVER_PATH.end - OBSERVER_PATH.start) * progress
      : OBSERVER_PATH.end - (OBSERVER_PATH.end - OBSERVER_PATH.start) * progress;
    const lane = OBSERVER_PATH.lanes[Math.floor(this.random() * OBSERVER_PATH.lanes.length)];
    const looks = OBSERVER_LOOKS[age].map((_, index) => index);
    const unusedLooks = looks.filter(look => !this.people.some(person => person.age === age && person.look === look));
    const availableLooks = unusedLooks.length ? unusedLooks : looks;
    const person: Observer = {
      id: this.nextId++, age, x, y: pathY(x, lane), lane, direction, stop: null,
      state: 'walking',
      speed: age === 'kid' ? this.between(37, 51) : this.between(32, 46),
      velocity: 0, look: availableLooks[Math.floor(this.random() * availableLooks.length)], scale: this.between(0.92, 1.1),
      stride: this.random() * 4, watchDuration: 0, watchRemaining: 0,
      interest: this.sceneInterest, quietAfter: this.between(5, 10), stopRoll: this.random(), hasWatched: false,
    };
    this.inviteToWatch(person);
    // Arrive into an already lived-in garden, including someone quietly watching.
    if (progress > 0 && person.stop && this.random() < 0.45) {
      person.x = person.stop.x; person.y = person.stop.y; person.state = 'watching'; person.hasWatched = true;
      person.watchRemaining *= this.between(0.3, 1);
    }
    if (progress > 0 && person.state !== 'watching') person.velocity = person.speed;
    this.people.push(person);
  }

  step(seconds: number): void {
    const dt = Math.max(0, Math.min(seconds, 0.1));
    if (dt === 0) return;
    this.elapsed += dt;
    const quietFor = this.elapsed - this.lastThrowAt;
    if (quietFor > 7.5) this.sceneInterest = Math.max(0.8, this.sceneInterest - dt * 0.018);
    for (const person of this.people) {
      if (quietFor > person.quietAfter) person.interest = Math.max(0.8, person.interest - dt * 0.018);
      if (person.state === 'watching') {
        person.velocity = 0;
        const watchRate = 1 + (1 - person.interest) * 0.6;
        person.watchRemaining = Math.max(0, person.watchRemaining - dt * watchRate);
        if (person.watchRemaining === 0) {
          person.state = 'leaving';
          // Begin with the legs together instead of restarting in a wide stride.
          person.stride = 1;
        }
        continue;
      }
      const before = { x: person.x, y: person.y };
      if (person.state === 'approaching' && person.stop && Math.abs(person.x - person.stop.x) > 80 &&
        person.stopRoll >= this.stopChance(person)) {
        person.state = 'walking'; person.stop = null; person.watchDuration = 0; person.watchRemaining = 0;
      }
      const remaining = person.state === 'approaching' && person.stop ? Math.abs(person.stop.x - person.x) : Infinity;
      const walk = walkingAdvance(person.velocity, person.speed, remaining, person.age === 'kid' ? 130 : 100, dt);
      person.velocity = walk.velocity;
      person.x += person.direction * walk.distance;
      if (person.state === 'approaching' && person.stop) {
        if ((person.stop.x - person.x) * person.direction <= 0) {
          person.x = person.stop.x; person.y = person.stop.y; person.state = 'watching'; person.hasWatched = true;
          person.velocity = 0;
        } else {
          const approach = pathBlend(1 - Math.abs(person.x - person.stop.x) / 80);
          person.y = pathY(person.x, person.lane) * (1 - approach) + person.stop.y * approach;
        }
      } else if (person.state === 'leaving' && person.stop) {
        const departure = pathBlend(Math.abs(person.x - person.stop.x) / 80);
        person.y = person.stop.y * (1 - departure) + pathY(person.x, person.lane) * departure;
        if (departure === 1) { person.state = 'walking'; person.stop = null; }
      } else person.y = pathY(person.x, person.lane);
      const travel = Math.hypot(person.x - before.x, person.y - before.y);
      person.stride += travel * 4 / walkingCycleDistance(person);
    }
    if (this.reviewingWalks) {
      // Keep the review running without random arrivals or pond-watching stops.
      for (const person of this.people) {
        if (person.x < OBSERVER_PATH.start || person.x > OBSERVER_PATH.end) {
          person.x = person.direction === 1 ? OBSERVER_PATH.start : OBSERVER_PATH.end;
          person.y = pathY(person.x, person.lane);
        }
      }
      return;
    }
    this.people = this.people.filter(person => person.x >= OBSERVER_PATH.start && person.x <= OBSERVER_PATH.end);
    this.arrivalIn -= dt;
    if (this.arrivalIn <= 0) {
      const count = this.people.length;
      // A soft limit makes crowds above eight rare; the hard limit keeps long visits bounded.
      const chance = count >= 10 ? 0 : count >= 8 ? 0.03 : count >= 6 ? 0.25 : count >= 5 ? 0.6 : 1;
      if (this.random() < chance) this.arrive();
      this.arrivalIn = this.nextArrival();
    }
  }
}
