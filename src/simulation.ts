import { PelletMachine } from './vending.ts';
import { planThrow, THROW_MOTIONS, LUCKY_BONUS_POINTS, PELLET_FLIGHT_TIME_SCALE, releaseOrigin, releaseHeight, type ThrowPlan, type ThrowEvent, type ThrowFacing } from './throws.ts';
import { DOCK_POSITION } from './thrower-art.ts';
import { ObserverCrowd } from './observers.ts';
import { MachineEmployee } from './restocking.ts';
import { WindSimulation } from './wind.ts';
import { eatingDuration, type Meal } from './eating.ts';

export type AnimalKind = 'fish' | 'bird' | 'turtle';
export type MovementPattern = 'glide' | 'meander' | 'shoal' | 'paddle' | 'sweep' | 'drift' | 'amble';
export interface BirdFlightProfile {
  minDistance: number; maxDistance: number; speed: number; height: number; flapRate: number;
}
export interface AnimalProfile {
  id: string; name: string; kind: AnimalKind; texture: string;
  speed: number; vision: number; bite: number; chew: number; turnRate: number;
  size: number; count: number; tint: number; movement: MovementPattern; description: string;
  flight?: BirdFlightProfile;
}
export const ANIMAL_BASELINE = { speed: 42, vision: 160, bite: 0.6, chew: 1.5, turnRate: 2.4, size: 42, count: 10, tint: 0xffffff };
export const SPECIES: AnimalProfile[] = [
  { ...ANIMAL_BASELINE, id: 'koi', name: 'Golden carp', kind: 'fish', texture: 'koi', movement: 'glide', speed: 30, bite: 1, chew: 2.6, turnRate: 1.3, size: 54, count: 12, description: 'Warm golden scales and slow, sweeping glides. A big bite, then a contented chew.' },
  { ...ANIMAL_BASELINE, id: 'carp', name: 'Common carp', kind: 'fish', texture: 'carp', movement: 'meander', speed: 52, vision: 190, bite: 0.65, chew: 1.5, size: 46, count: 14, description: 'Olive-bronze scales and a sturdy body. Meanders in soft curves toward a landing pellet.' },
  { ...ANIMAL_BASELINE, id: 'minnow', name: 'Young carp', kind: 'fish', texture: 'minnow', movement: 'shoal', speed: 78, vision: 120, bite: 0.3, chew: 0.65, turnRate: 8, size: 30, count: 20, description: 'Slender young carp dart in little shoals, happy with a small nibble.' },
  { ...ANIMAL_BASELINE, id: 'duck', name: 'Mallard', kind: 'bird', texture: 'duck', movement: 'paddle', speed: 48, vision: 230, bite: 1, chew: 2.2, size: 62, count: 6, flight: { minDistance: 180, maxDistance: 360, speed: 270, height: 36, flapRate: 10 }, description: 'Prefers a gentle paddle, but takes a short flight when crumbs land farther away.' },
  { ...ANIMAL_BASELINE, id: 'gull', name: 'Cheeky gull', kind: 'bird', texture: 'gull', movement: 'sweep', speed: 68, vision: 310, bite: 1, chew: 0.9, turnRate: 3, size: 50, count: 4, flight: { minDistance: 100, maxDistance: 520, speed: 330, height: 52, flapRate: 6 }, description: 'Quick to take wing for distant crumbs, then glides down to snatch them at the water.' },
  { ...ANIMAL_BASELINE, id: 'coot', name: 'Little coot', kind: 'bird', texture: 'coot', movement: 'drift', speed: 38, vision: 150, bite: 0.45, chew: 1.8, size: 42, count: 5, flight: { minDistance: 150, maxDistance: 260, speed: 230, height: 26, flapRate: 11 }, description: 'Quietly paddles and drifts near the edge, with an occasional low flight for a tempting crumb.' },
];
// A quiet extra resident, deliberately absent from the field guide's SPECIES list.
export const MUSK_TURTLE: AnimalProfile = {
  ...ANIMAL_BASELINE, id: 'musk-turtle', name: 'Musk turtle', kind: 'turtle', texture: 'musk-turtle',
  movement: 'amble', speed: 18, vision: 105, bite: 0.4, chew: 5.4, turnRate: 1.1, size: 48, count: 1,
  description: 'A little striped head, a domed olive shell, and all the time in the world.',
};
export const TURTLE_SURFACE_SECONDS = 5;
export const POND = { x: 600, y: 389, rx: 498, ry: 230 };
export const THROW_ORIGIN = releaseOrigin('toss');
export const FLOAT_SECONDS = 1.7;
export const BIRD_TAKEOFF_SECONDS = 0.28;
export const BIRD_LANDING_SECONDS = 0.32;
// Screen-space drift per second at full wind strength; depth is foreshortened.
const AIRBORNE_WIND_DRIFT = { x: 48, y: 32 };
export interface Point { x: number; y: number }
export interface BirdFlight {
  origin: Point; destination: Point; elapsed: number; duration: number;
}
export interface Animal extends Point {
  id: number; profile: AnimalProfile; destination: Point; heading: number;
  chewLeft: number; state: 'roaming' | 'approaching' | 'chewing' | 'taking-off' | 'flying' | 'landing'; moving: boolean;
  meal: Meal | null;
  surfaceLeft: number; surfaceDuration: number;
  school: number; phase: number; altitude: number; flight: BirdFlight | null;
}
// Small body cores leave fins, tails, and feathers free to overlap naturally.
export function animalCollisionRadius(animal: Animal): number {
  return animal.profile.size * (animal.profile.kind === 'fish' ? 0.14 : animal.profile.kind === 'turtle' ? 0.18 : 0.2);
}
export function shareCollisionLayer(first: Animal, second: Animal): boolean {
  // Flying birds can pass above swimmers and one another; landing restores body separation.
  if (first.flight || second.flight) return false;
  return (first.profile.kind === 'bird') === (second.profile.kind === 'bird');
}
export interface Food extends Point {
  origin: Point; launchHeight: number;
  id: number; amount: number; age: number; phase: 'air' | 'water';
  target: Point; // Landing point, adjusted by wind only while airborne.
  flightTime: number; flightDuration: number; height: number;
  releaseAt: number; arcScale: number; lucky: boolean; bonusClaimed: boolean;
}
export interface BiteEvent extends Point { kind: AnimalKind; animal: number; amount: number; phase: 'air' | 'water'; bonus: number }
export interface Splash extends Point { food: number }
export interface BirdSplash extends Point { animal: number; phase: 'takeoff' | 'landing' }
export function inPond(point: Point): boolean {
  return ((point.x - POND.x) / POND.rx) ** 2 + ((point.y - POND.y) / POND.ry) ** 2 < 1;
}
function distance(a: Point, b: Point): number { return Math.hypot(a.x - b.x, a.y - b.y); }
function angleDelta(from: number, to: number): number { return Math.atan2(Math.sin(to - from), Math.cos(to - from)); }
export function flightPosition(food: Food, time = food.flightTime): Point & { height: number } {
  const t = Math.min(1, Math.max(0, time / food.flightDuration));
  const arc = Math.sin(Math.PI * t) * (85 + distance(food.origin, food.target) * 0.12) * food.arcScale;
  const height = food.launchHeight * (1 - t) + arc;
  return { x: food.origin.x + (food.target.x - food.origin.x) * t,
    y: food.origin.y + (food.target.y - food.origin.y) * t - arc, height };
}

export class PondSimulation {
  readonly wind: WindSimulation;
  crowd: ObserverCrowd;
  animals: Animal[] = [];
  food: Food[] = [];
  bites: BiteEvent[] = [];
  splashes: Splash[] = [];
  birdSplashes: BirdSplash[] = [];
  machine = new PelletMachine();
  employee = new MachineEmployee();
  fedFish = new Set<number>();
  fishFood = 0;
  birdFood = 0;
  turtleFood = 0;
  luckyBonus = 0;
  nextThrow: ThrowPlan | null = null;
  lastThrow: ThrowEvent | null = null;
  throwFacing: ThrowFacing = -1;
  handfuls = 0;
  elapsed = 0;
  paused = false;
  private nextFood = 0;
  private random: () => number;
  private throwRandom: () => number;
  private throwQueue: ThrowEvent[] = [];
  private nextThrowId = 0;
  private lastObservedThrow = -1;
  private schools = new Map<number, Point>();

  constructor(seed = Date.now(), throwRandom?: () => number) {
    this.wind = new WindSimulation(seed);
    // Independent randomness keeps foot traffic from affecting animals or lucky throws.
    this.crowd = new ObserverCrowd(seed ^ 0xa511e9b3);
    let value = seed >>> 0;
    this.random = () => {
      value += 0x6d2b79f5;
      let t = Math.imul(value ^ value >>> 15, 1 | value);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    this.throwRandom = throwRandom ?? this.random;
    for (const profile of [...SPECIES, MUSK_TURTLE]) {
      let schoolCenter = this.randomPoint(0, 0.7);
      for (let i = 0; i < profile.count; i++) {
        if (i % 5 === 0) schoolCenter = this.randomPoint(0, 0.7);
        const school = profile.movement === 'shoal' ? Math.floor(i / 5) : -1;
        const point = school >= 0
          ? { x: schoolCenter.x + (this.random() - 0.5) * 50, y: schoolCenter.y + (this.random() - 0.5) * 30 }
          : this.randomPoint(profile.kind === 'bird' ? 0.65 : 0, 0.92);
        this.animals.push({ ...point, id: this.animals.length, profile, destination: this.randomPoint(), heading: this.random() * Math.PI * 2, chewLeft: 0, meal: null, surfaceLeft: 0, surfaceDuration: TURTLE_SURFACE_SECONDS, state: 'roaming', moving: false, school, phase: this.random() * Math.PI * 2, altitude: 0, flight: null });
        if (school >= 0 && !this.schools.has(school)) this.schools.set(school, this.randomPoint());
      }
    }
    this.separateAnimals();
  }

  randomPoint(minRadius = 0, maxRadius = 0.9): Point {
    const angle = this.random() * Math.PI * 2;
    const radius = Math.sqrt(minRadius ** 2 + this.random() * (maxRadius ** 2 - minRadius ** 2));
    return { x: POND.x + Math.cos(angle) * POND.rx * radius, y: POND.y + Math.sin(angle) * POND.ry * radius };
  }
  buyPellets(): boolean { return this.machine.insertCoin(); }
  scatter(point: Point): boolean {
    if (this.paused || this.machine.busy || this.handfuls <= 0 || !inPond(point)) return false;
    const plan = this.nextThrow ?? planThrow(this.throwRandom);
    const motion = THROW_MOTIONS[plan.animation];
    const queued = this.throwQueue.at(-1);
    const facing: ThrowFacing = point.x === DOCK_POSITION.x ? queued?.facing ?? this.throwFacing : point.x < DOCK_POSITION.x ? -1 : 1;
    const origin = releaseOrigin(plan.animation, facing);
    const startedAt = queued ? Math.max(this.elapsed, queued.startedAt + THROW_MOTIONS[queued.animation].duration) : this.elapsed;
    const action = { ...plan, id: this.nextThrowId++, startedAt, facing };
    this.throwQueue.push(action);
    if (startedAt <= this.elapsed) this.throwFacing = facing;
    this.lastThrow = action;
    this.handfuls -= 1;
    const aimDistance = Math.max(1, distance(origin, point));
    const forward = { x: (point.x - origin.x) / aimDistance, y: (point.y - origin.y) / aimDistance };
    for (let i = 0; i < 4; i++) {
      const sideJitter = this.random() - 0.5;
      const forwardJitter = this.random() - 0.5;
      const across = (i - 1.5) * 32 + sideJitter * 6;
      const along = forwardJitter * 18;
      const offset = plan.animation === 'spread'
        ? { x: point.x - forward.y * across + forward.x * along, y: point.y + forward.x * across + forward.y * along }
        : { x: point.x + sideJitter * 36, y: point.y + forwardJitter * 24 };
      const target = inPond(offset) ? offset : { ...point };
      this.food.push({
        ...origin, origin: { ...origin }, launchHeight: releaseHeight(plan.animation),
        id: this.nextFood++, amount: 1, age: 0, phase: 'air', target,
        flightTime: 0, flightDuration: (0.65 + distance(origin, target) / 700) * motion.flightScale * PELLET_FLIGHT_TIME_SCALE,
        height: releaseHeight(plan.animation), releaseAt: startedAt + motion.releaseDelay, arcScale: motion.arcScale,
        lucky: plan.lucky && i === 0, bonusClaimed: false,
      });
    }
    this.nextThrow = this.handfuls > 0 ? planThrow(this.throwRandom) : null;
    return true;
  }
  get eatenFood(): number { return this.fishFood + this.birdFood + this.turtleFood; }
  get fishShare(): number { return this.eatenFood > 0 ? this.fishFood / this.eatenFood : 0; }
  get score(): number { return Math.round((this.fishFood + this.turtleFood) * 10) + this.luckyBonus; }
  get currentThrow(): ThrowEvent | null {
    const action = this.throwQueue[0];
    return action && action.startedAt <= this.elapsed ? action : null;
  }
  get pendingThrows(): number { return this.throwQueue.length; }

  private updateSchools(): void {
    for (const [school, destination] of this.schools) {
      const members = this.animals.filter(animal => animal.school === school && animal.state !== 'chewing');
      if (!members.length) continue;
      const center = { x: members.reduce((sum, a) => sum + a.x, 0) / members.length, y: members.reduce((sum, a) => sum + a.y, 0) / members.length };
      if (distance(center, destination) < 45) this.schools.set(school, this.randomPoint(0, 0.8));
    }
  }

  private roam(animal: Animal): { destination: Point; pace: number; bend: number } {
    const pattern = animal.profile.movement;
    const t = this.elapsed;
    if (pattern === 'sweep') {
      const angle = animal.phase + t * 0.12;
      return { destination: { x: POND.x + Math.cos(angle) * 380, y: POND.y + Math.sin(angle) * 160 }, pace: 0.6, bend: 0 };
    }
    if (pattern === 'shoal') {
      const goal = this.schools.get(animal.school) ?? this.randomPoint();
      const members = this.animals.filter(a => a.school === animal.school && a.id !== animal.id);
      const near = members.filter(a => distance(a, animal) < 100);
      const center = near.length ? { x: near.reduce((s, a) => s + a.x, 0) / near.length, y: near.reduce((s, a) => s + a.y, 0) / near.length } : goal;
      return {
        destination: { x: goal.x * 0.55 + center.x * 0.45 + Math.cos(animal.phase + t) * 18, y: goal.y * 0.55 + center.y * 0.45 + Math.sin(animal.phase + t) * 12 },
        pace: 0.25 + Math.max(0, Math.sin(t * 2.1 + animal.school)) ** 6 * 0.65, bend: 0,
      };
    }
    if (distance(animal, animal.destination) < 28 || !inPond(animal.destination)) {
      animal.destination = pattern === 'drift' ? this.randomPoint(0.72, 0.9) : this.randomPoint();
    }
    if (pattern === 'drift') return { destination: animal.destination, pace: 0.08 + Math.max(0, Math.sin(t * 0.8 + animal.phase)) * 0.28, bend: Math.sin(t * 0.6 + animal.phase) * 0.12 };
    if (pattern === 'paddle') return { destination: animal.destination, pace: 0.38, bend: Math.sin(t * 1.1 + animal.phase) * 0.3 };
    if (pattern === 'meander') return { destination: animal.destination, pace: 0.38, bend: Math.sin(t * 0.75 + animal.phase) * 0.5 };
    if (pattern === 'amble') return { destination: animal.destination, pace: 0.3, bend: Math.sin(t * 0.35 + animal.phase) * 0.16 };
    return { destination: animal.destination, pace: 0.26, bend: 0 };
  }

  private swimmingHeading(animal: Animal, destination: Point, bend: number): number {
    const heading = Math.atan2(destination.y - animal.y, destination.x - animal.x) + bend;
    const forward = { x: Math.cos(heading), y: Math.sin(heading) };
    let x = forward.x, y = forward.y;
    for (const other of this.animals) {
      // Fish and the turtle share the water below the floating birds.
      if (other === animal || !shareCollisionLayer(animal, other)) continue;
      const dx = other.x - animal.x, dy = other.y - animal.y;
      const gap = Math.hypot(dx, dy);
      const room = (animalCollisionRadius(animal) + animalCollisionRadius(other)) * 1.8;
      if (gap >= room || gap < 0.0001) continue;
      const toward = { x: dx / gap, y: dy / gap };
      const pressure = 1 - gap / room;
      x -= toward.x * pressure * 0.8;
      y -= toward.y * pressure * 0.8;
      // A small turn to the right prevents two animals meeting head-on from stalling.
      if (forward.x * toward.x + forward.y * toward.y > 0.35) {
        x -= forward.y * pressure * 0.45;
        y += forward.x * pressure * 0.45;
      }
    }
    return Math.atan2(y, x);
  }

  private keepBodyInPond(animal: Animal): void {
    const radius = animalCollisionRadius(animal);
    const x = animal.x - POND.x, y = animal.y - POND.y;
    const squared = (x / POND.rx) ** 2 + (y / POND.ry) ** 2;
    const slope = Math.hypot(x / POND.rx ** 2, y / POND.ry ** 2);
    const rim = (radius / Math.min(POND.rx, POND.ry)) ** 2;
    // Bound the entire circle against the ellipse, including its curved banks.
    if (squared + 2 * radius * slope + rim >= 1) {
      const scale = (Math.sqrt((radius * slope) ** 2 + squared * (1 - rim)) - radius * slope) / squared * 0.9999;
      animal.x = POND.x + x * scale;
      animal.y = POND.y + y * scale;
    }
  }

  private separateAnimals(iterations = 16): void {
    for (const animal of this.animals) if (!animal.flight) this.keepBodyInPond(animal);
    for (let pass = 0; pass < iterations; pass++) {
      let separated = false;
      for (let i = 0; i < this.animals.length; i++) for (let j = i + 1; j < this.animals.length; j++) {
        const first = this.animals[i], second = this.animals[j];
        if (!shareCollisionLayer(first, second)) continue;
        const firstRadius = animalCollisionRadius(first), secondRadius = animalCollisionRadius(second);
        const dx = second.x - first.x, dy = second.y - first.y;
        const squared = dx * dx + dy * dy;
        const touching = firstRadius + secondRadius;
        if (squared >= touching * touching) continue;
        const gap = Math.sqrt(squared);
        const overlap = touching - gap;
        if (overlap <= 0.01) continue;
        separated = true;
        // Stable fallback for coincident centers, without consuming gameplay randomness.
        const angle = (first.id * 31 + second.id * 17 + 1) * 2.399963229728653;
        const normal = gap > 0.0001 ? { x: dx / gap, y: dy / gap } : { x: Math.cos(angle), y: Math.sin(angle) };
        const firstShare = secondRadius ** 2 / (firstRadius ** 2 + secondRadius ** 2);
        first.x -= normal.x * overlap * firstShare; first.y -= normal.y * overlap * firstShare;
        second.x += normal.x * overlap * (1 - firstShare); second.y += normal.y * overlap * (1 - firstShare);
        this.keepBodyInPond(first); this.keepBodyInPond(second);
      }
      if (!separated) break;
    }
  }

  private startFlight(animal: Animal, destination: Point): void {
    const profile = animal.profile.flight!;
    animal.flight = {
      origin: { x: animal.x, y: animal.y }, destination: { ...destination }, elapsed: 0,
      duration: BIRD_TAKEOFF_SECONDS + distance(animal, destination) / profile.speed + BIRD_LANDING_SECONDS,
    };
    animal.heading = Math.atan2(destination.y - animal.y, destination.x - animal.x);
    animal.state = 'taking-off';
    this.birdSplashes.push({ x: animal.x, y: animal.y, animal: animal.id, phase: 'takeoff' });
  }

  private updateFlight(animal: Animal, dt: number): void {
    const flight = animal.flight!;
    flight.elapsed = Math.min(flight.duration, flight.elapsed + dt);
    const t = flight.elapsed / flight.duration;
    const progress = t * t * (3 - 2 * t);
    animal.x = flight.origin.x + (flight.destination.x - flight.origin.x) * progress;
    animal.y = flight.origin.y + (flight.destination.y - flight.origin.y) * progress;
    const lift = Math.min(1, flight.elapsed / BIRD_TAKEOFF_SECONDS,
      (flight.duration - flight.elapsed) / BIRD_LANDING_SECONDS);
    animal.altitude = Math.sin(lift * Math.PI / 2) * animal.profile.flight!.height;
    animal.moving = true;
    animal.state = flight.elapsed < BIRD_TAKEOFF_SECONDS ? 'taking-off'
      : flight.elapsed < flight.duration - BIRD_LANDING_SECONDS ? 'flying' : 'landing';
    if (flight.elapsed >= flight.duration) {
      animal.flight = null; animal.altitude = 0; animal.state = 'approaching'; animal.moving = false;
      this.birdSplashes.push({ x: animal.x, y: animal.y, animal: animal.id, phase: 'landing' });
    }
  }

  step(seconds: number): void {
    const dt = Math.max(0, Math.min(seconds, 0.1));
    this.handfuls += this.machine.step(dt);
    if (this.handfuls > 0 && !this.nextThrow) this.nextThrow = planThrow(this.throwRandom);
    if (this.paused || dt === 0) return;
    this.employee.step(dt, this.machine);
    this.elapsed += dt;
    this.wind.advanceTo(this.elapsed);
    this.crowd.step(dt);
    this.throwQueue = this.throwQueue.filter(action => this.elapsed < action.startedAt + THROW_MOTIONS[action.animation].duration);
    const released = this.currentThrow;
    if (released) this.throwFacing = released.facing;
    if (released && released.id !== this.lastObservedThrow &&
      this.elapsed >= released.startedAt + THROW_MOTIONS[released.animation].releaseDelay) {
      this.lastObservedThrow = released.id;
      this.crowd.noticeThrow();
    }
    for (const food of this.food) {
      if (food.phase === 'air') {
        const flightStart = Math.max(this.elapsed - dt, food.releaseAt);
        const flightDt = Math.min(this.elapsed - flightStart, food.flightDuration - food.flightTime);
        if (flightDt <= 0) continue;
        // Integrate just the airborne part of the frame, including a partial
        // release/landing frame. Midpoint sampling follows the shared weather
        // and keeps drift consistent across render frame rates.
        const wind = this.wind.sampleAt(flightStart + flightDt / 2);
        let x = food.target.x + wind.x * AIRBORNE_WIND_DRIFT.x * flightDt;
        let y = food.target.y + wind.y * AIRBORNE_WIND_DRIFT.y * flightDt;
        const radius = Math.hypot((x - POND.x) / POND.rx, (y - POND.y) / POND.ry);
        if (radius >= 1) {
          x = POND.x + (x - POND.x) / radius * 0.9999;
          y = POND.y + (y - POND.y) / radius * 0.9999;
        }
        // The arc approaches this moving destination smoothly; birds and the
        // final splash use the same point, so food never snaps back on landing.
        food.target = { x, y };
        food.flightTime = Math.min(food.flightDuration, food.flightTime + flightDt);
        Object.assign(food, flightPosition(food));
        if (food.flightTime >= food.flightDuration) {
          food.phase = 'water'; food.x = food.target.x; food.y = food.target.y; food.height = 0; food.age = 0;
          if (food.amount > 0) this.splashes.push({ x: food.x, y: food.y, food: food.id });
        }
      } else {
        food.age += dt;
        const drift = { x: food.x + Math.sin(food.id + food.age) * dt * 1.6, y: food.y + dt * 0.8 };
        if (inPond(drift)) { food.x = drift.x; food.y = drift.y; }
      }
    }
    this.updateSchools();
    for (const animal of this.animals) {
      animal.moving = false;
      animal.surfaceLeft = Math.max(0, animal.surfaceLeft - dt);
      if (animal.flight) {
        this.updateFlight(animal, dt);
        continue;
      }
      if (animal.chewLeft > 0) {
        animal.chewLeft = Math.max(0, animal.chewLeft - dt);
        if (animal.chewLeft < 1e-9) animal.chewLeft = 0;
        animal.state = animal.chewLeft > 0 ? 'chewing' : 'roaming';
        if (!animal.chewLeft) animal.meal = null;
        continue;
      }
      if (animal.profile.kind === 'turtle' && animal.surfaceLeft > 0) continue;
      const profile = animal.profile;
      let target: Food | undefined;
      let nearest = Infinity;
      for (const food of this.food) {
        if (food.amount <= 0 || food.age > 13 || this.elapsed < food.releaseAt) continue;
        if (profile.kind !== 'bird' && food.phase !== 'water') continue;
        if (profile.kind === 'bird' && food.phase === 'water' && food.age > FLOAT_SECONDS) continue;
        // Choose from the expected water landing point, including the current wind drift.
        const d = distance(animal, food.phase === 'air' ? food.target : food);
        const flight = profile.kind === 'bird' ? profile.flight : undefined;
        if (d > (flight?.maxDistance ?? profile.vision)) continue;
        if (flight && d >= flight.minDistance) {
          const available = food.phase === 'air' ? food.flightDuration - food.flightTime + FLOAT_SECONDS : FLOAT_SECONDS - food.age;
          const duration = BIRD_TAKEOFF_SECONDS + d / flight.speed + BIRD_LANDING_SECONDS;
          if (duration + dt >= available) continue;
        } else if (d > profile.vision) continue;
        if (d < nearest) { target = food; nearest = d; }
      }
      let destination: Point;
      let pace: number;
      let bend = 0;
      if (target) {
        animal.state = 'approaching';
        destination = target.phase === 'air' ? target.target : target;
        pace = 1;
        // Species distance bands decide when to fly, rather than comparing travel modes by speed.
        if (profile.kind === 'bird' && profile.flight && nearest >= profile.flight.minDistance) {
          this.startFlight(animal, destination);
          this.updateFlight(animal, dt);
          continue;
        }
        const reachable = target.phase === 'water' || (target.height <= 22 && distance(animal, target) < Math.max(9, profile.size * 0.2));
        if (reachable && nearest < Math.max(9, profile.size * 0.2)) {
          const amount = Math.min(profile.bite, target.amount);
          target.amount = Math.max(0, target.amount - amount);
          animal.chewLeft = eatingDuration(profile, amount);
          animal.meal = { duration: animal.chewLeft, amount };
          animal.state = 'chewing';
          let bonus = 0;
          if (profile.kind === 'fish') { this.fishFood += amount; this.fedFish.add(animal.id); }
          else if (profile.kind === 'turtle') {
            this.turtleFood += amount;
            // Stay visible through the entire meal, then gently dip underwater.
            animal.surfaceDuration = Math.max(TURTLE_SURFACE_SECONDS, animal.chewLeft + 0.75);
            animal.surfaceLeft = animal.surfaceDuration;
          } else this.birdFood += amount;
          if (profile.kind === 'fish' && target.lucky && !target.bonusClaimed) {
            target.bonusClaimed = true;
            bonus = LUCKY_BONUS_POINTS;
            this.luckyBonus += bonus;
          }
          this.bites.push({ x: target.x, y: target.y, kind: profile.kind, animal: animal.id, amount, phase: target.phase, bonus });
          this.crowd.noticeEating(amount);
          continue;
        }
      } else {
        animal.state = 'roaming';
        const motion = this.roam(animal);
        destination = motion.destination; pace = motion.pace; bend = motion.bend;
      }
      const desired = this.swimmingHeading(animal, destination, bend);
      const turn = profile.turnRate * (target ? 1.8 : 1) * dt;
      animal.heading += Math.max(-turn, Math.min(turn, angleDelta(animal.heading, desired)));
      const travel = Math.min(distance(animal, destination), profile.speed * pace * dt);
      const next = { x: animal.x + Math.cos(animal.heading) * travel, y: animal.y + Math.sin(animal.heading) * travel };
      if (inPond(next)) { animal.x = next.x; animal.y = next.y; animal.moving = travel > 0.001; }
      else { animal.heading = Math.atan2(POND.y - animal.y, POND.x - animal.x); animal.destination = this.randomPoint(0, 0.7); }
    }
    this.separateAnimals();
    this.food = this.food.filter(food => food.amount > 0.001 && (food.phase === 'air' || food.age < 13));
  }
}
