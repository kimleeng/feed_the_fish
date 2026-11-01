import type { AnimalProfile, Point } from './simulation.ts';

export const SWAN_ATLAS = 'swan';
// A visiting bird, absent from the resident population and field guide.
export const SWAN: AnimalProfile = {
  id: 'swan', name: 'Mute swan', kind: 'bird', texture: 'swan',
  speed: 42, vision: 320, bite: 1, chew: 2.6, turnRate: 1.3,
  size: 92, count: 1, tint: 0xffffff, movement: 'glide',
  // Passage flights bring it into and out of the garden; it paddles to food.
  flight: { minDistance: Infinity, maxDistance: 320, speed: 230, height: 70, flapRate: 5 },
  description: 'A white visitor with a long curved neck, drawn to a quietly generous pond.',
};

export type SwanPhase = 'away' | 'waiting' | 'arriving' | 'visiting' | 'departing';
export type SwanPassage = 'arrival' | 'departure';
interface PondBounds extends Point { rx: number; ry: number }

/** One repeatable visit, triggered only by a real turtle bite while away. */
export class SwanVisit {
  phase: SwanPhase = 'away';
  arrivesAt: number | null = null;
  animalId: number | null = null;
  meals = 0;
  private exitSide = 1;
  private random: () => number;

  constructor(random: () => number) { this.random = random; }

  noticeTurtleMeal(elapsed: number): void {
    if (this.phase !== 'away') return;
    this.phase = 'waiting';
    this.arrivesAt = elapsed + 10 + this.random() * 5;
  }

  beginArrival(elapsed: number, pond: PondBounds): { origin: Point; destination: Point } | null {
    if (this.phase !== 'waiting' || this.arrivesAt === null || elapsed < this.arrivesAt) return null;
    const side = this.random() < .5 ? -1 : 1;
    this.exitSide = -side;
    this.phase = 'arriving'; this.arrivesAt = null; this.meals = 0;
    return {
      origin: { x: pond.x + side * (pond.rx + 300), y: pond.y - 110 + this.random() * 100 },
      destination: { x: pond.x + (this.random() - .5) * pond.rx * .8,
        y: pond.y + (this.random() - .5) * pond.ry * .7 },
    };
  }

  land(): void { this.phase = 'visiting'; }

  noticeMeal(animalId: number): void {
    if (this.phase === 'visiting' && animalId === this.animalId) this.meals = Math.min(2, this.meals + 1);
  }

  readyToLeave(animalId: number): boolean {
    return this.phase === 'visiting' && animalId === this.animalId && this.meals >= 2;
  }

  beginDeparture(pond: PondBounds): Point {
    this.phase = 'departing';
    return { x: pond.x + this.exitSide * (pond.rx + 300), y: pond.y - 110 + this.random() * 100 };
  }

  finishDeparture(): void {
    this.phase = 'away'; this.animalId = null;
  }
}
