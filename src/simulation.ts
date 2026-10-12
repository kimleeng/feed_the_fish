export type AnimalKind = 'fish' | 'bird';
export interface AnimalProfile {
  id: string; name: string; kind: AnimalKind; texture: string;
  speed: number; vision: number; bite: number; chew: number;
  size: number; count: number; tint: number; description: string;
}

export const ANIMAL_BASELINE = { speed: 42, vision: 160, bite: 0.6, chew: 1.5, size: 42, count: 10, tint: 0xffffff };
export const SPECIES: AnimalProfile[] = [
  { ...ANIMAL_BASELINE, id: 'koi', name: 'Golden koi', kind: 'fish', texture: 'koi', speed: 30, bite: 1, chew: 2.6, size: 54, count: 12, description: 'Slow and lovely. Takes a big bite, then a long, contented chew.' },
  { ...ANIMAL_BASELINE, id: 'carp', name: 'Silver carp', kind: 'fish', texture: 'carp', speed: 52, vision: 190, bite: 0.65, chew: 1.5, size: 46, count: 14, description: 'A curious all-rounder. Often first to notice a sinking crumb.' },
  { ...ANIMAL_BASELINE, id: 'minnow', name: 'Little minnow', kind: 'fish', texture: 'carp', speed: 78, vision: 120, bite: 0.3, chew: 0.65, size: 30, count: 20, tint: 0xb8dfcd, description: 'Tiny, quick, and always peckish. A nibble is more than enough.' },
  { ...ANIMAL_BASELINE, id: 'duck', name: 'Mallard', kind: 'bird', texture: 'duck', speed: 48, vision: 230, bite: 1, chew: 2.2, size: 62, count: 6, description: 'A determined paddler with a soft spot for floating food.' },
  { ...ANIMAL_BASELINE, id: 'gull', name: 'Cheeky gull', kind: 'bird', texture: 'gull', speed: 105, vision: 290, bite: 1, chew: 0.9, size: 50, count: 4, description: 'Spots a crumb from afar. Fast, bold, and a little too clever.' },
  { ...ANIMAL_BASELINE, id: 'dove', name: 'Garden dove', kind: 'bird', texture: 'gull', speed: 36, vision: 135, bite: 0.45, chew: 1.8, size: 38, count: 5, tint: 0xc6b3cc, description: 'A gentle opportunist. Likes small bites near the pond’s edge.' },
];

export const POND = { x: 600, y: 389, rx: 498, ry: 230 };
export const ROUND_SECONDS = 90;
export const HANDFULS = 60;
export const FLOAT_SECONDS = 1.7;

export interface Point { x: number; y: number }
export interface Animal extends Point {
  id: number; profile: AnimalProfile; destination: Point;
  chewLeft: number; state: 'roaming' | 'approaching' | 'chewing'; facing: number;
}
export interface Food extends Point { id: number; amount: number; age: number }
export interface BiteEvent extends Point { kind: AnimalKind; animal: number; amount: number }

export function inPond(point: Point): boolean {
  return ((point.x - POND.x) / POND.rx) ** 2 + ((point.y - POND.y) / POND.ry) ** 2 < 1;
}
function distance(a: Point, b: Point): number { return Math.hypot(a.x - b.x, a.y - b.y); }

export class PondSimulation {
  animals: Animal[] = [];
  food: Food[] = [];
  bites: BiteEvent[] = [];
  fedFish = new Set<number>();
  fishFood = 0;
  birdFood = 0;
  handfuls = HANDFULS;
  elapsed = 0;
  started = false;
  paused = false;
  finished = false;
  private nextFood = 0;
  private random: () => number;

  constructor(seed = Date.now()) {
    let value = seed >>> 0;
    this.random = () => {
      value += 0x6d2b79f5;
      let t = Math.imul(value ^ value >>> 15, 1 | value);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    for (const profile of SPECIES) {
      for (let i = 0; i < profile.count; i++) {
        const point = this.randomPoint(profile.kind === 'bird' ? 0.65 : 0, 0.93);
        this.animals.push({ ...point, id: this.animals.length, profile, destination: this.randomPoint(), chewLeft: 0, state: 'roaming', facing: this.random() > 0.5 ? 1 : -1 });
      }
    }
  }

  randomPoint(minRadius = 0, maxRadius = 0.9): Point {
    const angle = this.random() * Math.PI * 2;
    const radius = Math.sqrt(minRadius ** 2 + this.random() * (maxRadius ** 2 - minRadius ** 2));
    return { x: POND.x + Math.cos(angle) * POND.rx * radius, y: POND.y + Math.sin(angle) * POND.ry * radius };
  }

  scatter(point: Point): boolean {
    if (this.paused || this.finished || this.handfuls <= 0 || !inPond(point)) return false;
    this.started = true;
    this.handfuls -= 1;
    for (let i = 0; i < 4; i++) {
      const offset = { x: point.x + (this.random() - 0.5) * 36, y: point.y + (this.random() - 0.5) * 24 };
      this.food.push({ ...(inPond(offset) ? offset : point), id: this.nextFood++, amount: 1, age: 0 });
    }
    return true;
  }

  get fishShare(): number {
    return this.fishFood + this.birdFood > 0 ? this.fishFood / (this.fishFood + this.birdFood) : 0;
  }
  get secondsLeft(): number { return Math.max(0, Math.ceil(ROUND_SECONDS - this.elapsed)); }

  step(seconds: number): void {
    if (this.paused || this.finished) return;
    const dt = Math.max(0, Math.min(seconds, 0.1));
    if (this.started) {
      this.elapsed += dt;
      if (this.elapsed >= ROUND_SECONDS) { this.finished = true; return; }
    }
    for (const food of this.food) {
      food.age += dt;
      const drift = { x: food.x + Math.sin(food.id + food.age) * dt * 1.6, y: food.y + dt * 0.8 };
      if (inPond(drift)) { food.x = drift.x; food.y = drift.y; }
    }
    for (const animal of this.animals) {
      if (animal.chewLeft > 0) {
        animal.chewLeft = Math.max(0, animal.chewLeft - dt);
        animal.state = animal.chewLeft > 0 ? 'chewing' : 'roaming';
        continue;
      }
      const profile = animal.profile;
      let target: Food | undefined;
      let nearest = profile.vision;
      for (const food of this.food) {
        if (food.amount <= 0 || food.age > 13) continue;
        if (profile.kind === 'bird' && food.age > FLOAT_SECONDS) continue;
        const d = distance(animal, food);
        if (d < nearest) { target = food; nearest = d; }
      }
      if (target) {
        animal.destination = target;
        animal.state = 'approaching';
        if (nearest < Math.max(9, profile.size * 0.2) && (profile.kind === 'bird' || target.age >= 0.4)) {
          const amount = Math.min(profile.bite, target.amount);
          target.amount = Math.max(0, target.amount - amount);
          animal.chewLeft = profile.chew;
          animal.state = 'chewing';
          if (profile.kind === 'fish') { this.fishFood += amount; this.fedFish.add(animal.id); }
          else this.birdFood += amount;
          this.bites.push({ x: target.x, y: target.y, kind: profile.kind, animal: animal.id, amount });
          continue;
        }
      } else {
        animal.state = 'roaming';
        if (distance(animal, animal.destination) < 14 || !inPond(animal.destination)) animal.destination = this.randomPoint();
      }
      const dx = animal.destination.x - animal.x;
      const dy = animal.destination.y - animal.y;
      const d = Math.hypot(dx, dy);
      if (d > 0) {
        const move = Math.min(d, profile.speed * (target ? 1 : 0.45) * dt);
        animal.x += dx / d * move;
        animal.y += dy / d * move;
        if (Math.abs(dx) > 1) animal.facing = dx > 0 ? 1 : -1;
      }
    }
    this.food = this.food.filter(food => food.amount > 0.001 && food.age < 13);
  }
}
