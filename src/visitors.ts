import { gestureFrame } from './idles.ts';

export type VisitorHabit = 'look-out' | 'weight-shift' | 'hat-adjust' | 'read-map' | 'lean-watch' | 'point';
export const VISITOR_DURATIONS: Record<VisitorHabit, readonly [number, number]> = {
  'look-out': [2, 3], 'weight-shift': [1.8, 2.6], 'hat-adjust': [1.8, 2.6],
  'read-map': [3, 4], 'lean-watch': [2.5, 3.5], point: [2, 3],
};
export interface Visitor {
  id: number; x: number; y: number; size: number; facingLeft: boolean;
  signature: VisitorHabit; nextIdleAt: number;
  idle: { habit: VisitorHabit; elapsed: number; duration: number } | null;
}

// These feet positions lie on the far garden path, outside the playable water.
// A narrow foreground slice of the original garden occludes their lower legs
// behind its railing, grounding them in the existing illustration.
export const VISITOR_PLACES = [
  { x: 435, y: 119, size: 78, facingLeft: false, signature: 'hat-adjust' },
  { x: 550, y: 118, size: 76, facingLeft: true, signature: 'read-map' },
  { x: 680, y: 119, size: 78, facingLeft: true, signature: 'lean-watch' },
  { x: 808, y: 124, size: 80, facingLeft: true, signature: 'point' },
] as const;

export class GardenVisitors {
  people: Visitor[];
  private nextGestureAt = 10;
  private random: () => number;
  constructor(seed: number) {
    let state = (seed ^ 0x2f63a5bd) >>> 0;
    // Independent stream: background gestures cannot change feeding or lucky rolls.
    this.random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
    this.people = VISITOR_PLACES.map((place, id) => ({ ...place, id, nextIdleAt: 8 + this.random() * 20, idle: null }));
  }

  step(dt: number, elapsed: number): void {
    for (const person of this.people) {
      if (!person.idle) continue;
      person.idle.elapsed = Math.min(person.idle.duration, person.idle.elapsed + dt);
      if (person.idle.elapsed >= person.idle.duration) person.idle = null;
    }
    if (elapsed < this.nextGestureAt) return;
    this.nextGestureAt = elapsed + 12 + this.random() * 10;
    if (this.people.some(person => person.idle)) return;
    const available = this.people.filter(person => person.nextIdleAt <= elapsed);
    if (!available.length) return;
    const person = available[Math.floor(this.random() * available.length)];
    const roll = this.random();
    const habit = roll < 0.7 ? person.signature : roll < 0.85 ? 'look-out' : 'weight-shift';
    const [min, max] = VISITOR_DURATIONS[habit];
    person.idle = { habit, elapsed: 0, duration: min + this.random() * (max - min) };
    person.nextIdleAt = elapsed + 35 + this.random() * 30;
  }
}

export function visitorPose(person: Visitor, reducedMotion = false): { frame: string; x: number; angle: number; scaleY: number } {
  const action = person.idle;
  const t = action ? action.elapsed / action.duration : 0;
  const envelope = Math.sin(Math.PI * t) ** 2;
  const side = person.facingLeft ? -1 : 1;
  const frame = action?.habit === person.signature ? gestureFrame(t) : 0;
  return {
    frame: `visitor-${person.id}-${reducedMotion ? 0 : frame}`,
    x: !reducedMotion && action?.habit === 'weight-shift' ? side * envelope * 1.5 : 0,
    angle: !reducedMotion && action?.habit === 'look-out' ? side * envelope * 3 : 0,
    scaleY: !reducedMotion && action?.habit === 'weight-shift' ? 1 - envelope * 0.025 : 1,
  };
}
