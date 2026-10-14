import { PelletMachine } from './vending.ts';
import { planThrow, THROW_MOTIONS, LUCKY_BONUS_POINTS, releaseOrigin, releaseHeight, type ThrowPlan, type ThrowEvent } from './throws.ts';
import { ObserverCrowd } from './observers.ts';

export type AnimalKind = 'fish' | 'bird';
export type MovementPattern = 'glide' | 'meander' | 'shoal' | 'paddle' | 'sweep' | 'drift';
export interface AnimalProfile {
  id: string; name: string; kind: AnimalKind; texture: string;
  speed: number; vision: number; bite: number; chew: number; turnRate: number;
  size: number; count: number; tint: number; movement: MovementPattern; description: string;
}
export const ANIMAL_BASELINE = { speed: 42, vision: 160, bite: 0.6, chew: 1.5, turnRate: 2.4, size: 42, count: 10, tint: 0xffffff };
export const SPECIES: AnimalProfile[] = [
  { ...ANIMAL_BASELINE, id: 'koi', name: 'Golden carp', kind: 'fish', texture: 'koi', movement: 'glide', speed: 30, bite: 1, chew: 2.6, turnRate: 1.3, size: 54, count: 12, description: 'Warm golden scales and slow, sweeping glides. A big bite, then a contented chew.' },
  { ...ANIMAL_BASELINE, id: 'carp', name: 'Common carp', kind: 'fish', texture: 'carp', movement: 'meander', speed: 52, vision: 190, bite: 0.65, chew: 1.5, size: 46, count: 14, description: 'Olive-bronze scales and a sturdy body. Meanders in soft curves toward a landing pellet.' },
  { ...ANIMAL_BASELINE, id: 'minnow', name: 'Young carp', kind: 'fish', texture: 'minnow', movement: 'shoal', speed: 78, vision: 120, bite: 0.3, chew: 0.65, turnRate: 8, size: 30, count: 20, description: 'Slender young carp dart in little shoals, happy with a small nibble.' },
  { ...ANIMAL_BASELINE, id: 'duck', name: 'Mallard', kind: 'bird', texture: 'duck', movement: 'paddle', speed: 48, vision: 230, bite: 1, chew: 2.2, size: 62, count: 6, description: 'Paddles in gentle curves and watches where the airborne crumbs will land.' },
  { ...ANIMAL_BASELINE, id: 'gull', name: 'Cheeky gull', kind: 'bird', texture: 'gull', movement: 'sweep', speed: 68, vision: 310, bite: 1, chew: 0.9, turnRate: 3, size: 50, count: 4, description: 'Swims in broad loops and snatches low-flying pellets as they reach the water.' },
  { ...ANIMAL_BASELINE, id: 'coot', name: 'Little coot', kind: 'bird', texture: 'coot', movement: 'drift', speed: 38, vision: 150, bite: 0.45, chew: 1.8, size: 42, count: 5, description: 'A few quiet paddle strokes, then a gentle drift near the edge of the pond.' },
];
export const POND = { x: 600, y: 389, rx: 498, ry: 230 };
export const THROW_ORIGIN = releaseOrigin('toss');
export const FLOAT_SECONDS = 1.7;
export interface Point { x: number; y: number }
export interface Animal extends Point {
  id: number; profile: AnimalProfile; destination: Point; heading: number;
  chewLeft: number; state: 'roaming' | 'approaching' | 'chewing'; moving: boolean;
  school: number; phase: number;
}
export interface Food extends Point {
  origin: Point; launchHeight: number;
  id: number; amount: number; age: number; phase: 'air' | 'water';
  target: Point; flightTime: number; flightDuration: number; height: number;
  releaseAt: number; arcScale: number; lucky: boolean; bonusClaimed: boolean;
}
export interface BiteEvent extends Point { kind: AnimalKind; animal: number; amount: number; phase: 'air' | 'water'; bonus: number }
export interface Splash extends Point { food: number }
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
  crowd: ObserverCrowd;
  animals: Animal[] = [];
  food: Food[] = [];
  bites: BiteEvent[] = [];
  splashes: Splash[] = [];
  machine = new PelletMachine();
  fedFish = new Set<number>();
  fishFood = 0;
  birdFood = 0;
  luckyBonus = 0;
  nextThrow: ThrowPlan | null = null;
  lastThrow: ThrowEvent | null = null;
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
    for (const profile of SPECIES) {
      let schoolCenter = this.randomPoint(0, 0.7);
      for (let i = 0; i < profile.count; i++) {
        if (i % 5 === 0) schoolCenter = this.randomPoint(0, 0.7);
        const school = profile.movement === 'shoal' ? Math.floor(i / 5) : -1;
        const point = school >= 0
          ? { x: schoolCenter.x + (this.random() - 0.5) * 50, y: schoolCenter.y + (this.random() - 0.5) * 30 }
          : this.randomPoint(profile.kind === 'bird' ? 0.65 : 0, 0.92);
        this.animals.push({ ...point, id: this.animals.length, profile, destination: this.randomPoint(), heading: this.random() * Math.PI * 2, chewLeft: 0, state: 'roaming', moving: false, school, phase: this.random() * Math.PI * 2 });
        if (school >= 0 && !this.schools.has(school)) this.schools.set(school, this.randomPoint());
      }
    }
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
    const origin = releaseOrigin(plan.animation);
    const queued = this.throwQueue.at(-1);
    const startedAt = queued ? Math.max(this.elapsed, queued.startedAt + THROW_MOTIONS[queued.animation].duration) : this.elapsed;
    const action = { ...plan, id: this.nextThrowId++, startedAt };
    this.throwQueue.push(action);
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
        flightTime: 0, flightDuration: (0.65 + distance(origin, target) / 700) * motion.flightScale,
        height: releaseHeight(plan.animation), releaseAt: startedAt + motion.releaseDelay, arcScale: motion.arcScale,
        lucky: plan.lucky && i === 0, bonusClaimed: false,
      });
    }
    this.nextThrow = this.handfuls > 0 ? planThrow(this.throwRandom) : null;
    return true;
  }
  get fishShare(): number { return this.fishFood + this.birdFood > 0 ? this.fishFood / (this.fishFood + this.birdFood) : 0; }
  get score(): number { return Math.round(this.fishFood * 10) + this.luckyBonus; }
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
    return { destination: animal.destination, pace: 0.26, bend: 0 };
  }

  step(seconds: number): void {
    const dt = Math.max(0, Math.min(seconds, 0.1));
    this.handfuls += this.machine.step(dt);
    if (this.handfuls > 0 && !this.nextThrow) this.nextThrow = planThrow(this.throwRandom);
    if (this.paused) return;
    this.elapsed += dt;
    this.crowd.step(dt);
    this.throwQueue = this.throwQueue.filter(action => this.elapsed < action.startedAt + THROW_MOTIONS[action.animation].duration);
    const released = this.currentThrow;
    if (released && released.id !== this.lastObservedThrow &&
      this.elapsed >= released.startedAt + THROW_MOTIONS[released.animation].releaseDelay) {
      this.lastObservedThrow = released.id;
      this.crowd.noticeThrow();
    }
    for (const food of this.food) {
      if (food.phase === 'air') {
        const flightDt = Math.min(dt, Math.max(0, this.elapsed - food.releaseAt));
        if (flightDt <= 0) continue;
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
      if (animal.chewLeft > 0) {
        animal.chewLeft = Math.max(0, animal.chewLeft - dt);
        animal.state = animal.chewLeft > 0 ? 'chewing' : 'roaming';
        continue;
      }
      const profile = animal.profile;
      let target: Food | undefined;
      let nearest = profile.vision;
      for (const food of this.food) {
        if (food.amount <= 0 || food.age > 13 || this.elapsed < food.releaseAt) continue;
        if (profile.kind === 'fish' && food.phase !== 'water') continue;
        if (profile.kind === 'bird' && food.phase === 'water' && food.age > FLOAT_SECONDS) continue;
        // Swimming birds watch the landing point while food is high in the air.
        const d = distance(animal, food.phase === 'air' ? food.target : food);
        if (d < nearest) { target = food; nearest = d; }
      }
      let destination: Point;
      let pace: number;
      let bend = 0;
      if (target) {
        animal.state = 'approaching';
        destination = target.phase === 'air' ? target.target : target;
        pace = 1;
        const reachable = target.phase === 'water' || (target.height <= 22 && distance(animal, target) < Math.max(9, profile.size * 0.2));
        if (reachable && nearest < Math.max(9, profile.size * 0.2)) {
          const amount = Math.min(profile.bite, target.amount);
          target.amount = Math.max(0, target.amount - amount);
          animal.chewLeft = profile.chew;
          animal.state = 'chewing';
          let bonus = 0;
          if (profile.kind === 'fish') { this.fishFood += amount; this.fedFish.add(animal.id); }
          else this.birdFood += amount;
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
      const desired = Math.atan2(destination.y - animal.y, destination.x - animal.x) + bend;
      const turn = profile.turnRate * (target ? 1.8 : 1) * dt;
      animal.heading += Math.max(-turn, Math.min(turn, angleDelta(animal.heading, desired)));
      const travel = Math.min(distance(animal, destination), profile.speed * pace * dt);
      const next = { x: animal.x + Math.cos(animal.heading) * travel, y: animal.y + Math.sin(animal.heading) * travel };
      if (inPond(next)) { animal.x = next.x; animal.y = next.y; animal.moving = travel > 0.001; }
      else { animal.heading = Math.atan2(POND.y - animal.y, POND.x - animal.x); animal.destination = this.randomPoint(0, 0.7); }
    }
    this.food = this.food.filter(food => food.amount > 0.001 && (food.phase === 'air' || food.age < 13));
  }
}
