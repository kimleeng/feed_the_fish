export type ObserverAge = 'adult' | 'kid';
export type ObserverState = 'walking' | 'approaching' | 'watching' | 'leaving';
interface Point { x: number; y: number }

export interface Observer extends Point {
  id: number;
  age: ObserverAge;
  state: ObserverState;
  direction: -1 | 1;
  speed: number;
  lane: number;
  look: number;
  scale: number;
  stride: number;
  stop: Point | null;
  watchDuration: number;
  watchRemaining: number;
}

export const OBSERVER_PATH = { start: -50, end: 1250, lanes: [760, 773, 784] };
// Dry paving in front of the railing, leaving the machine and throwing arm clear.
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

  private between(min: number, max: number): number { return min + this.random() * (max - min); }

  private nextArrival(): number {
    // Uneven foot traffic lets the population fluctuate naturally.
    return 2.5 - Math.log(1 - this.random()) * 13;
  }

  private arrive(progress = 0, age: ObserverAge = this.random() < 0.35 ? 'kid' : 'adult'): void {
    const direction = this.random() < 0.5 ? 1 : -1;
    const x = direction === 1
      ? OBSERVER_PATH.start + (OBSERVER_PATH.end - OBSERVER_PATH.start) * progress
      : OBSERVER_PATH.end - (OBSERVER_PATH.end - OBSERVER_PATH.start) * progress;
    const lane = OBSERVER_PATH.lanes[Math.floor(this.random() * OBSERVER_PATH.lanes.length)];
    const interest = OBSERVER_INTEREST[age];
    const available = WATCH_SPOTS.filter(spot => (spot.x - x) * direction > 50 &&
      !this.people.some(person => person.stop === spot));
    const stop = this.random() < interest.stopChance && available.length
      ? available[Math.floor(this.random() * available.length)] : null;
    const range = this.random() < interest.longWatchChance ? interest.long : interest.short;
    const watchDuration = stop ? this.between(range[0], range[1]) : 0;
    const person: Observer = {
      id: this.nextId++, age, x, y: pathY(x, lane), lane, direction, stop,
      state: stop ? 'approaching' : 'walking',
      speed: age === 'kid' ? this.between(37, 51) : this.between(32, 46),
      look: Math.floor(this.random() * 8), scale: this.between(0.94, 1.06),
      stride: this.random() * 4, watchDuration, watchRemaining: watchDuration,
    };
    // Arrive into an already lived-in garden, including someone quietly watching.
    if (progress > 0 && stop && this.random() < 0.45) {
      person.x = stop.x; person.y = stop.y; person.state = 'watching';
      person.watchRemaining *= this.between(0.3, 1);
    }
    this.people.push(person);
  }

  step(seconds: number): void {
    const dt = Math.max(0, Math.min(seconds, 0.1));
    if (dt === 0) return;
    this.elapsed += dt;
    for (const person of this.people) {
      if (person.state === 'watching') {
        person.watchRemaining = Math.max(0, person.watchRemaining - dt);
        if (person.watchRemaining === 0) person.state = 'leaving';
        continue;
      }
      const before = person.x;
      person.x += person.direction * person.speed * dt;
      if (person.state === 'approaching' && person.stop) {
        if ((person.stop.x - person.x) * person.direction <= 0) {
          person.x = person.stop.x; person.y = person.stop.y; person.state = 'watching';
        } else {
          const approach = Math.max(0, 1 - Math.abs(person.x - person.stop.x) / 80);
          person.y = pathY(person.x, person.lane) * (1 - approach) + person.stop.y * approach;
        }
      } else if (person.state === 'leaving' && person.stop) {
        const departure = Math.min(1, Math.abs(person.x - person.stop.x) / 80);
        person.y = person.stop.y * (1 - departure) + pathY(person.x, person.lane) * departure;
        if (departure === 1) { person.state = 'walking'; person.stop = null; }
      } else person.y = pathY(person.x, person.lane);
      person.stride += Math.abs(person.x - before) / 9;
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
